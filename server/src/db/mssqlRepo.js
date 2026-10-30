// SQL Server repository. Same tables and rules as the old WinForms program
// (Matching/Data/*.cs), but every value goes in as a parameter.
import sql from 'mssql';
import { config } from '../config.js';
import { passwordToken } from '../legacyCrypto.js';

let poolPromise;
function pool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config.db).connect().catch((err) => {
      poolPromise = undefined;
      throw err;
    });
  }
  return poolPromise;
}

const fmt = (col) => `CONVERT(varchar(10), ${col}, 103) + ' ' + CONVERT(varchar(5), ${col}, 108)`;

export async function loginWithPassword(username, password) {
  const r = await (await pool())
    .request()
    .input('username', sql.NVarChar, username)
    .input('password', sql.Binary, passwordToken(password)).query(`
      SELECT us.vc_UserId AS userId, us.vc_Name AS name
      FROM [HAD].[dbo].[ms_users] us
      WHERE us.vc_Username = @username AND us.vc_Password = @password AND ISNULL(us.DeleteYN, 'N') = 'N'`);
  return r.recordset[0] ?? null;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const r = await (await pool())
    .request()
    .input('id', sql.NVarChar, userId)
    .input('current', sql.Binary, passwordToken(currentPassword))
    .input('next', sql.Binary, passwordToken(newPassword)).query(`
      UPDATE [HAD].[dbo].[ms_users] SET vc_Password = @next
      WHERE vc_UserId = @id AND vc_Password = @current AND ISNULL(DeleteYN, 'N') = 'N'`);
  return r.rowsAffected[0] === 1;
}

export async function loginWithQr(code) {
  const r = await (await pool()).request().input('code', sql.NVarChar, code).query(`
    SELECT us.vc_UserId AS userId, us.vc_Name AS name
    FROM [HAD].[dbo].[ms_users] us
    WHERE us.UserRD = @code AND ISNULL(us.DeleteYN, 'N') = 'N'`);
  return r.recordset[0] ?? null;
}

export async function getWards() {
  const r = await (await pool()).request().query(`
    SELECT FacilityCode AS code, FacilityLocalName AS name
    FROM IPharmaFacility
    ORDER BY FacilityLocalName`);
  return r.recordset;
}

export async function findScannable(rxNumber) {
  const r = await (await pool())
    .request()
    .input('rx', sql.VarChar, rxNumber)
    .input('days', sql.Int, config.scanLookbackDays).query(`
      SELECT TOP 1 RxNumber AS rxNumber, ISNULL(MatchingStatus, '0') AS matchingStatus
      FROM IPharmaIRxStatus
      WHERE RxNumber = @rx
        AND ISNULL(DispenseStatus, '0') = '1'
        AND CONVERT(date, DispenseDatetime) >= CONVERT(date, DATEADD(day, -@days, GETDATE()))`);
  const row = r.recordset[0];
  return row ? { rxNumber: row.rxNumber, matched: String(row.matchingStatus) !== '0' } : null;
}

export async function markMatched(rxNumber, userId) {
  // Old program only updated rows where MatchingStatus IS NULL but treated 0 as "not matched" too,
  // so a 0 in the database made every scan fail. Both now count as not matched.
  const r = await (await pool())
    .request()
    .input('rx', sql.VarChar, rxNumber)
    .input('userId', sql.VarChar, userId).query(`
      UPDATE IPharmaIRxStatus
      SET MatchingStatus = 1, MatchingEmpID = @userId, MatchingDatetime = GETDATE()
      WHERE RxNumber = @rx AND DispenseStatus = 1 AND ISNULL(MatchingStatus, '0') = '0'`);
  return r.rowsAffected[0] > 0;
}

// Puts a prescription back to "not matched" (NULL, the state the old program started from).
export async function unmatch(rxNumber) {
  const r = await (await pool()).request().input('rx', sql.VarChar, rxNumber).query(`
    UPDATE IPharmaIRxStatus
    SET MatchingStatus = NULL, MatchingEmpID = NULL, MatchingDatetime = NULL
    WHERE RxNumber = @rx AND ISNULL(MatchingStatus, '0') <> '0'`);
  return r.rowsAffected[0] > 0;
}

export async function listUsers() {
  const r = await (await pool()).request().query(`
    SELECT vc_UserId AS userId, vc_Username AS username, vc_Name AS name
    FROM [HAD].[dbo].[ms_users]
    WHERE ISNULL(DeleteYN, 'N') = 'N'
    ORDER BY vc_Name`);
  return r.recordset;
}

export async function resetPassword(userId, newPassword) {
  const r = await (await pool())
    .request()
    .input('id', sql.NVarChar, userId)
    .input('next', sql.Binary, passwordToken(newPassword)).query(`
      UPDATE [HAD].[dbo].[ms_users] SET vc_Password = @next
      WHERE vc_UserId = @id AND ISNULL(DeleteYN, 'N') = 'N'`);
  return r.rowsAffected[0] === 1;
}

// matched=true: already scanned. matched=false: dispensed but not scanned yet (MatchingStatus NULL or 0,
// the same "not matched" rule markMatched uses).
async function searchOrders({ date, ward, orderType, hn, an, rx }, matched) {
  const req = (await pool()).request().input('date', sql.Date, date);
  const where = [
    'os.DispenseDatetime >= @date',
    'os.DispenseDatetime < DATEADD(day, 1, @date)',
    "ISNULL(os.DispenseStatus, '0') = '1'",
    matched ? "ISNULL(os.MatchingStatus, '0') = '1'" : "ISNULL(os.MatchingStatus, '0') <> '1'",
  ];
  if (hn) { req.input('hn', sql.VarChar, hn); where.push('p.PatientID = @hn'); }
  if (an) { req.input('an', sql.VarChar, an); where.push('o.AdmitNumber = @an'); }
  if (rx) { req.input('rx', sql.VarChar, rx); where.push('o.RxNumber = @rx'); }
  if (ward) { req.input('ward', sql.VarChar, ward); where.push('pt.FacilityCode = @ward'); }
  if (orderType) { req.input('orderType', sql.VarChar, orderType); where.push('o.OrderType = @orderType'); }

  const r = await req.query(`
    SELECT ${fmt('o.CreateDatetime')} AS createdAt,
           o.RxNumber AS rxNumber,
           ${fmt('o.OrderDatetime')} AS orderedAt,
           CONVERT(varchar(10), o.OrderType) AS orderType,
           p.PatientID AS hn,
           o.AdmitNumber AS an,
           p.PatientFullName AS patientName,
           w.FacilityLocalName AS wardName,
           emp.vc_Name AS matchedBy,
           ${fmt('os.MatchingDatetime')} AS matchedAt,
           ${fmt('os.DispenseDatetime')} AS dispensedAt
    FROM IPharmaIRx o
    INNER JOIN IPharmaIRxStatus os ON o.RxNumber = os.RxNumber
    LEFT JOIN IPharmaInPatientInfo pt ON o.AdmitNumber = pt.AdmitNumber
    INNER JOIN IPharmaPatientInfo p ON pt.PatientId = p.PatientId
    LEFT JOIN IPharmaFacility w ON pt.FacilityCode = w.FacilityCode
    LEFT JOIN [HAD].[dbo].[ms_users] emp ON os.MatchingEmpID = emp.vc_UserId
    WHERE ${where.join(' AND ')}
    ORDER BY ${matched ? 'os.MatchingDatetime DESC' : 'os.DispenseDatetime ASC'}`);
  return r.recordset;
}

export const searchMatched = (filters) => searchOrders(filters, true);
export const searchPending = (filters) => searchOrders(filters, false);

export async function getOrderItems(rxNumber) {
  const r = await (await pool()).request().input('rx', sql.VarChar, rxNumber).query(`
    SELECT DISTINCT od.ItemCode AS itemCode,
           d.LocalName AS drugName,
           od.OrderQty AS qty,
           itus.ItemUsageText AS usage,
           CASE WHEN dt.OrderDispenseType = 0 THEN 'Robot' ELSE N'จัดมือ' END AS location
    FROM IPharmaIRx o
    INNER JOIN IPharmaIRxItems od ON o.RxNumber = od.RxNumber AND od.VoidDateTime IS NULL
    LEFT JOIN IPharmaItemUsage itus ON od.ItemUsageCode = itus.ItemUsageCode
    INNER JOIN IPharmaItemInfo d ON od.ItemCode = d.ItemCode
    INNER JOIN IPharmaIDispensed dt ON od.RxNumber = dt.RxNumber AND od.ItemSeq = dt.ItemSeq
    WHERE od.OrderQty > 0 AND o.RxNumber = @rx`);
  return r.recordset;
}
