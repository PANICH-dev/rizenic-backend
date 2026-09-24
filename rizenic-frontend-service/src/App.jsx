import { useEffect, useState } from 'react';
import { login, logout as clearSession } from './api.js';
import RepairJobForm from './RepairJobForm.jsx';

const TOKEN_KEY = 'rizenic.session.token';
const USER_KEY = 'rizenic.session.employee';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  useEffect(() => {
    const expired = () => { clearSession(); setSession(null); setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); };
    window.addEventListener('rizenic:auth-expired', expired);
    return () => window.removeEventListener('rizenic:auth-expired', expired);
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!username.trim() || !password) { setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
    setError(''); setLoading(true);
    try {
      const result = await login(username.trim(), password);
      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.employee));
      setSession(result.employee);
    } catch (cause) {
      setError(cause.status === 401 ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : cause.message);
    } finally { setLoading(false); }
  }

  function logout() { clearSession(); setSession(null); setPassword(''); }

  if (session) return <RepairJobForm employee={session} onLogout={logout} />;

  return <main className="shell"><div className="glow glow-one" /><div className="glow glow-two" />
    <section className="login-layout">
      <div className="intro"><div className="brand-mark">R</div><p className="eyebrow">RIZENIC ERP</p><h1>จัดการทุกงานซ่อม<br /><span>ให้เป็นเรื่องง่าย</span></h1><p className="intro-copy">ระบบศูนย์รวมข้อมูลลูกค้า รถยนต์ อะไหล่ และกระบวนการซ่อมในที่เดียว</p><div className="status-pill"><i /> ระบบพร้อมใช้งาน</div></div>
      <div className="form-card"><div className="form-heading"><p className="eyebrow">ยินดีต้อนรับกลับ</p><h2>เข้าสู่ระบบ</h2><p className="muted">กรอกข้อมูลเพื่อเข้าสู่ RIZENIC ERP</p></div>
        <form onSubmit={submit} noValidate>
          <label>ชื่อผู้ใช้<input id="login-username" data-testid="login-username" autoFocus value={username} onChange={e=>setUsername(e.target.value)} placeholder="เช่น sa001" autoComplete="username" /></label>
          <label>รหัสผ่าน<div className="password-wrap"><input id="login-password" data-testid="login-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน" autoComplete="current-password" /><button type="button" className="show-button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'ซ่อน':'แสดง'}</button></div></label>
          {error && <div className="error-box" role="alert">{error}</div>}
          <button className="submit-button" data-testid="login-submit" type="submit" disabled={loading}>{loading?<><span className="spinner" />กำลังตรวจสอบ...</>:<>เข้าสู่ระบบ <span>→</span></>}</button>
        </form><p className="secure-note">ข้อมูลการเข้าสู่ระบบได้รับการปกป้องด้วยระบบเข้ารหัส</p>
      </div>
    </section><footer>© 2026 RIZENIC ERP · Service Advisor Platform</footer>
  </main>;
}
