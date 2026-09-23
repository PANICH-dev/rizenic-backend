function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function buildReportsReadQuery(query = {}) {
  const where = [];
  const values = [];
  const add = (sql, value) => {
    const v = clean(value);
    if (!v) return;
    values.push(v);
    where.push(sql.replace('?', `$${values.length}`));
  };

  add('branch_name = ?', query.branch);
  add('department_routing = ?', query.department_routing);
  add("COALESCE(job_status, '') <> ?", query.exclude_status);

  return {
    text: `SELECT * FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`,
    values
  };
}

function buildPartOrdersReadQuery(query = {}) {
  const branch = clean(query.branch);
  if (!branch) {
    return { text: 'SELECT * FROM rizenic_part_orders ORDER BY order_id DESC', values: [] };
  }
  return {
    text: 'SELECT * FROM rizenic_part_orders WHERE branch_name = $1 ORDER BY order_id DESC',
    values: [branch]
  };
}

function buildEmployeesReadQuery(query = {}) {
  const branch = clean(query.branch);
  if (!branch) {
    return { text: 'SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC', values: [] };
  }
  return {
    text: 'SELECT * FROM rizenicemployeemaster WHERE branch_name = $1 ORDER BY branch_name ASC, employee_code ASC',
    values: [branch]
  };
}

module.exports = { buildReportsReadQuery, buildPartOrdersReadQuery, buildEmployeesReadQuery };
