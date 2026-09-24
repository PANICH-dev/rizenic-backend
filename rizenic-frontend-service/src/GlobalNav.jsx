export default function GlobalNav({ onLogout }) {
  const links = [['/index.html','เปิดบิลซ่อม'],['/jobs.html','ทะเบียนใบงาน'],['/jobs_table.html','ตารางงานซ่อม'],['/parts.html','ระบบอะไหล่'],['/finance.html','บัญชีการเงิน'],['/dashboard.html','Dashboard']];
  return <nav className="global-nav" data-testid="global-navigation">{links.map(([href,label])=><a key={href} href={href}>{label}</a>)}<button data-testid="logout-button" onClick={onLogout}>ออกจากระบบ</button></nav>;
}
