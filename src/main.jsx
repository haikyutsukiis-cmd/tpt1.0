import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { strToU8, zipSync } from 'fflate';
import { supabase } from './lib/supabase';
import {
  LayoutDashboard, ClipboardList, Users, Package, Wrench, CalendarCheck,
  LogOut, Bell, Search, Download, Plus, ChevronDown, ArrowLeft, Check,
  Clock3, Settings, Box, TrendingUp, Menu, X, UserRound, Factory, BarChart3,
  TriangleAlert, CircleDollarSign, Eye, EyeOff
} from 'lucide-react';
import './styles.css';

const OPERATORS = ['AMRI', 'M. RIPAI', 'ERWIN', 'AGUS', 'SIGIT', 'HAFIDZ'];
const MACHINES = ['VMC 850', 'VMC 650', 'KASUGA', 'HYUNDAI', 'FINISHING', 'GENTAP'];
const ITEMS = ['72559', 'H122-AD1-9810', 'RUMAH KONIS', 'KLEM ATAS', 'KLEM SAMPING', 'MUR PENGIKAT', 'RING MUR PENGIKAT', 'POROS KLEM TENGAH', 'POROS KLEM SAMPING'];

function downloadCsv(fileName, rows) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
  downloadBlob(`${fileName}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

function downloadExcel(fileName, sheetName, rows) {
  const escapeXml = value => String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const columnName = index => {
    let name = '';
    for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) {
      name = String.fromCharCode(65 + (value - 1) % 26) + name;
    }
    return name;
  };
  const cells = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    if (value === null || value === undefined || value === '') return '';
    const address = `${columnName(columnIndex)}${rowIndex + 1}`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${address}"><v>${value}</v></c>`;
    return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const safeSheetName = String(sheetName).replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Laporan';
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      cells + '</sheetData></worksheet>')
  };
  downloadBlob(`${fileName}.xlsx`, zipSync(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function downloadBlob(fileName, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getWeekDates(weekValue) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) return {start: '', end: ''};
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10)
  };
}

function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatAttendanceTimestamp(timestamp) {
  if (!timestamp) return '—';
  return `${new Date(timestamp).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'medium'
  })} WIB`;
}

function mapRemoteRecord(table, row) {
  if (table === 'attendance_records') {
    return {
      id: row.id, operator: row.operator_name, date: row.shift_date,
      checkIn: row.check_in, checkOut: row.check_out, status: row.verification_status
    };
  }
  return {
    id: row.id, code: row.spk_code, operator: row.operator_name,
    date: getLocalDateKey(new Date(row.created_at)), createdAt: row.created_at,
    machine: row.machine, item: row.item_name, op: row.op_name,
    oke: row.qty_oke, repair: row.qty_repair, ng: row.qty_ng,
    status: row.verification_status, time: formatAttendanceTimestamp(row.created_at)
  };
}

function useRemoteRecords(table) {
  const [records,setRecords]=useState([]);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const orderColumn=table==='attendance_records'?'shift_date':'created_at';
    const {data,error:queryError}=await supabase.from(table).select('*').order(orderColumn,{ascending:false});
    if(queryError){setError(queryError.message);return;}
    setError('');
    setRecords(data.map(row=>mapRemoteRecord(table,row)));
  },[table]);

  useEffect(()=>{
    refresh();
    const channel=supabase.channel(`live-${table}`)
      .on('postgres_changes',{event:'*',schema:'public',table},refresh)
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR')setError(`Koneksi realtime ${table} gagal.`);
      });
    return ()=>{supabase.removeChannel(channel);};
  },[refresh,table]);

  const rpc=useCallback(async(functionName,args)=>{
    const {data,error:rpcError}=await supabase.rpc(functionName,args);
    if(rpcError){setError(rpcError.message);return null;}
    const row=Array.isArray(data)?data[0]:data;
    if(!row){setError('Server tidak mengembalikan catatan yang tersimpan.');return null;}
    setError('');
    const record=mapRemoteRecord(table,row);
    setRecords(current=>[record,...current.filter(item=>item.id!==record.id)]);
    return record;
  },[table]);

  const setVerificationStatus=useCallback(async(id,status)=>{
    const {data,error:updateError}=await supabase.from(table)
      .update({verification_status:status,reviewed_at:new Date().toISOString()})
      .eq('id',id).select('*').single();
    if(updateError){setError(updateError.message);return false;}
    setError('');
    const record=mapRemoteRecord(table,data);
    setRecords(current=>current.map(item=>item.id===id?record:item));
    return true;
  },[table]);

  return {records,error,refresh,rpc,setVerificationStatus};
}

function useMasterDataRecords() {
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const {data,error:queryError}=await supabase.from('master_data')
      .select('id,customer_name,item_name,quantity,qty_in_progress,qty_shipped,po_number')
      .order('created_at',{ascending:false});
    if(queryError){setError(queryError.message);setLoading(false);return;}
    setError('');
    setRecords(data);
    setLoading(false);
  },[]);
  useEffect(()=>{
    refresh();
    const channel=supabase.channel('live-master-data')
      .on('postgres_changes',{event:'*',schema:'public',table:'master_data'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR')setError('Koneksi realtime Master Data gagal.');});
    return ()=>{supabase.removeChannel(channel);};
  },[refresh]);
  return {records,loading,error,refresh};
}

function SyncError({error}) {
  return error?<div className="sync-error" role="alert">Sinkronisasi gagal: {error}</div>:null;
}

function Logo({ compact = false }) {
  return <div className="brand">
    <div className="brand-mark"><Factory size={compact ? 20 : 24}/></div>
    {!compact && <div><strong>TPT</strong><span>PRODUCTION CONTROL</span></div>}
  </div>;
}

function Modal({ title, children, onClose, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={e => e.stopPropagation()}>
      {title && <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>}
      {children}
    </div>
  </div>;
}

function Login({ role, onLogin, onBack }) {
  const [show, setShow] = useState(false);
  const [email,setEmail]=useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading,setLoading]=useState(false);
  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const {data,error:authError}=await supabase.auth.signInWithPassword({email,password});
    if(authError){setError(authError.message);setLoading(false);return;}
    const {data:profile,error:profileError}=await supabase.from('profiles')
      .select('role,display_name').eq('id',data.user.id).single();
    if(profileError||profile.role!==role.toLowerCase()){
      await supabase.auth.signOut();
      setError(profileError?.message||'Akun tidak memiliki akses ke portal ini.');
      setLoading(false);
      return;
    }
    onLogin(profile,data.session);
  };
  return <div className="login-page">
    <div className="login-card">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Kembali</button>
      <Logo/>
      <div className="login-icon">{role === 'ADMIN' ? <Settings/> : role==='BOSS'?<TrendingUp/>:<UserRound/>}</div>
      <h2>{role === 'ADMIN' ? 'Dashboard Administrasi' : role === 'BOSS' ? 'Dashboard Executive' : 'Portal Operator'}</h2>
      <p>Masuk untuk melanjutkan</p>
      <form onSubmit={submit}>
        <label>Email</label>
        <div className="password-field"><input type="email" autoComplete="username" required value={email} onChange={e=>{setEmail(e.target.value);setError('')}} placeholder="nama@perusahaan.com"/></div>
        <label>Password</label>
        <div className="password-field">
          <input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e=>{setPassword(e.target.value);setError('')}} placeholder="Masukkan password"/>
          <button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn full" disabled={loading}>{loading?'Memproses...':'Masuk Dashboard'}</button>
      </form>
      <small>Akun dibuat oleh Admin Supabase.</small>
    </div>
  </div>;
}

function PortalSelect({ onSelect }) {
  return <div className="portal-page">
    <div className="portal-brand"><Logo/><span>Portal Produksi</span></div>
    <div className="portal-wrap">
      <div className="portal-heading">
        <span className="eyebrow">SISTEM MANAJEMEN OPERASIONAL</span>
        <h1>Pilih Portal Anda</h1>
        <p>Akses sesuai dengan peran dan tanggung jawab kerja.</p>
      </div>
      <div className="portal-grid">
        <button className="portal-card" onClick={()=>onSelect('OPERATOR')}>
          <div className="portal-card-icon operator"><UserRound/></div>
          <h3>Portal Operator</h3><p>Absensi, laporan produksi, dan peminjaman tools.</p>
          <span>Masuk sebagai Operator <b>→</b></span>
        </button>
        <button className="portal-card" onClick={()=>onSelect('ADMIN')}>
          <div className="portal-card-icon admin"><Settings/></div>
          <h3>Administrasi</h3><p>Master data, verifikasi, stok, dan laporan operasional.</p>
          <span>Masuk sebagai Admin <b>→</b></span>
        </button>
        <button className="portal-card" onClick={()=>onSelect('BOSS')}>
          <div className="portal-card-icon boss"><TrendingUp/></div>
          <h3>Executive</h3><p>Monitoring performa, produksi, PO, dan efisiensi tools.</p>
          <span>Masuk sebagai Executive <b>→</b></span>
        </button>
      </div>
    </div>
  </div>;
}

function AppShell({ role, profile, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navByRole = {
    OPERATOR: [['dashboard','Beranda'],['production','SPK Produksi'],['attendance','Absensi'],['tools','Tools']],
    ADMIN: [['dashboard','Ringkasan'],['production','Produksi & SPK'],['attendance','Absensi'],['master','Master Data'],['inventory','Inventori Tools'],['materials','Inventori Material'],['reports','Laporan']],
    BOSS: [['dashboard','Ringkasan'],['production','Progres PO'],['performance','Performa'],['tools','Efisiensi Tools'],['reports','Laporan']]
  };
  const [active, setActive] = useState('dashboard');
  return <div className="app-shell">
    <aside className={menuOpen?'open':''}>
      <div className="side-head"><Logo/><button className="side-close" onClick={()=>setMenuOpen(false)}><X size={20}/></button></div>
      <nav>{navByRole[role].map(([id,label]) =>
        <button key={id} className={active===id?'active':''} onClick={()=>{setActive(id);setMenuOpen(false)}}>{iconFor(id)}<span>{label}</span></button>
      )}</nav>
      <div className="side-bottom"><button className="logout" onClick={onLogout}><LogOut size={18}/><span>Keluar</span></button></div>
    </aside>
    {menuOpen && <div className="side-overlay" onClick={()=>setMenuOpen(false)}/>}
    <main>
      <header className="topbar">
        <button className="menu-btn" onClick={()=>setMenuOpen(true)}><Menu size={22}/></button>
        <div><span className="top-role">{role}</span><strong>{role==='OPERATOR'?'Portal Operator':role==='ADMIN'?'Dashboard Administrasi':'Executive Dashboard'}</strong></div>
        <div className="top-actions"><button className="notification"><Bell size={19}/><i/></button><div className="avatar">{role==='OPERATOR'?'OP':role==='ADMIN'?'AD':'EX'}</div></div>
      </header>
      <div className="content">{React.cloneElement(children, {active, setActive, profile})}</div>
    </main>
  </div>;
}

function iconFor(id) {
  const icons={dashboard:<LayoutDashboard size={19}/>,production:<ClipboardList size={19}/>,attendance:<CalendarCheck size={19}/>,tools:<Wrench size={19}/>,master:<Users size={19}/>,inventory:<Package size={19}/>,materials:<Box size={19}/>,reports:<Download size={19}/>,performance:<BarChart3 size={19}/>}
  return icons[id];
}

function Operator({ active, setActive, profile }) {
  const [warning,setWarning]=useState(true);
  const [operator]=useState(profile.display_name);
  const [modal,setModal]=useState(null);
  const attendanceApi=useRemoteRecords('attendance_records');
  const productionApi=useRemoteRecords('production_reports');
  const masterDataApi=useMasterDataRecords();
  const activeOrders=masterDataApi.records.filter(record=>record.quantity-record.qty_shipped>0);
  const outstandingTotal=masterDataApi.records.reduce(
    (total,record)=>total+Math.max(0,record.quantity-record.qty_shipped),0
  );
  const today=getLocalDateKey();
  const attendanceRecord=attendanceApi.records.find(record=>record.operator===operator&&record.date===today);
  const attended=Boolean(attendanceRecord?.checkIn);
  const clocked=attended&&!attendanceRecord.checkOut;
  const hasSubmittedProduction=productionApi.records.some(report=>report.operator===operator&&report.date===today);
  const clockIn=()=>attendanceApi.rpc('operator_clock_in',{p_shift_date:today});
  const clockOut=()=>attendanceRecord?.id&&attendanceApi.rpc('operator_clock_out',{p_attendance_id:attendanceRecord.id});
  const todayLabel=new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
  if(warning) return <Modal title="Peringatan Awal" onClose={()=>setWarning(false)}>
    <div className="warning-icon"><TriangleAlert size={28}/></div>
    <p className="warning-text">Harap memasukkan laporan sesuai aktual dengan jujur. Pengajuan izin sakit maksimal H-10 jam sebelum shift, dan pengajuan cuti/libur maksimal H-1 minggu sebelum tanggal libur.</p>
    <button className="primary-btn full" onClick={()=>setWarning(false)}>Saya Mengerti</button>
  </Modal>;
  if(active==='attendance') return <Attendance operator={operator} attendanceRecord={attendanceRecord} attended={attended} clocked={clocked} hasSubmittedProduction={hasSubmittedProduction} onClockIn={clockIn} onClockOut={clockOut} setActive={setActive} error={attendanceApi.error}/>;
  if(active==='production') return <Production operator={operator} clocked={clocked} setActive={setActive} productionApi={productionApi}/>;
  if(active==='tools') return <OperatorTools operator={operator} />;
  return <div>
    <div className="page-title"><div><span>Hari Ini · {todayLabel}</span><h1>Selamat Bekerja, {operator}</h1></div></div>
    <SyncError error={attendanceApi.error||productionApi.error||masterDataApi.error}/>
    <div className="operator-status">
      <div className="status-card"><div className="status-icon green"><Clock3/></div><div><span>Status Kehadiran</span><strong>{attendanceRecord?.checkOut?'Sudah Absen Pulang':clocked?'Sudah Absen Masuk':'Belum Absen Masuk'}</strong></div></div>
      <button className="primary-btn" onClick={()=>setActive('attendance')}>{attended?'Kelola Absensi':'Absen Sekarang'} <ChevronDown size={16}/></button>
    </div>
    <div className="section-head"><h2>Informasi Kerja</h2></div>
    <div className="kpi-grid operator-kpi">
      <div className="kpi-card"><span>Hasil Hari Ini</span><strong>84</strong><small className="positive">+12% dari kemarin</small></div>
      <div className="kpi-card"><span>Outstanding Item</span><strong>{activeOrders.length}</strong><small>{outstandingTotal.toLocaleString('id-ID')} pcs tersisa</small></div>
      <div className="kpi-card"><span>Efisiensi</span><strong>92%</strong><small className="positive">Irit tools</small></div>
    </div>
    <div className="two-col">
      <div className="panel"><div className="panel-head"><h3>Master Data &amp; Outstanding Aktual</h3><span className="live-dot">LIVE</span></div>
        <div className="table-wrap"><table><thead><tr><th>Customer / PO</th><th>Produk</th><th>Target</th><th>Berjalan</th><th>Terkirim</th><th>Outstanding</th></tr></thead><tbody>
          {masterDataApi.records.map(record=><tr key={record.id}>
            <td><strong>{record.customer_name}</strong>{record.po_number&&<small>{record.po_number}</small>}</td>
            <td>{record.item_name}</td><td>{record.quantity} pcs</td><td>{record.qty_in_progress} pcs</td><td>{record.qty_shipped} pcs</td>
            <td><strong>{Math.max(0,record.quantity-record.qty_shipped)} pcs</strong></td>
          </tr>)}
        </tbody></table>
          {masterDataApi.loading&&<p className="table-message">Memuat Master Data...</p>}
          {!masterDataApi.loading&&!masterDataApi.records.length&&!masterDataApi.error&&<p className="table-message">Belum ada data Master Data.</p>}
        </div>
      </div>
      <div className="panel"><div className="panel-head"><h3>Aksi Cepat</h3></div>
        <div className="quick-actions">
          <button onClick={()=>setActive('production')}><ClipboardList/><span>Input Produksi</span></button>
          <button onClick={()=>setActive('tools')}><Wrench/><span>Ambil Tools</span></button>
          <button onClick={()=>setActive('attendance')}><CalendarCheck/><span>Izin / Cuti</span></button>
        </div>
      </div>
    </div>
  </div>;
}

function LoadingLine({item,progress,qty}) {
  return <div className="loading-row"><div className="loading-name"><strong>{item}</strong><span>{qty}</span></div><div className="progress"><i style={{width:progress+'%'}}/></div><b>{progress}%</b></div>;
}

function Attendance({operator,attendanceRecord,attended,clocked,hasSubmittedProduction,onClockIn,onClockOut,setActive,error}) {
  const [modal,setModal]=useState(null);
  const [leaveKind,setLeaveKind]=useState('Izin Sakit');
  const todayLabel=new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
  return <div>
    <div className="page-title"><div><span>Absensi Operator · {todayLabel}</span><h1>Hari Ini</h1></div><strong>{operator}</strong></div>
    <SyncError error={error}/>
    <div className="attendance-grid">
      <div className="attendance-card"><CalendarCheck size={28}/><span>Absen Masuk</span><strong>{attendanceRecord?.checkIn?formatAttendanceTimestamp(attendanceRecord.checkIn):'Belum Absen'}</strong><button className="primary-btn" disabled={attended} onClick={onClockIn}>Absen Masuk</button></div>
      <div className="attendance-card"><Clock3 size={28}/><span>Absen Pulang</span><strong>{attendanceRecord?.checkOut?formatAttendanceTimestamp(attendanceRecord.checkOut):hasSubmittedProduction?'Siap Absen Pulang':'Selesai input SPK terlebih dahulu'}</strong><button className="outline-btn" disabled={!clocked||!hasSubmittedProduction||Boolean(attendanceRecord?.checkOut)} onClick={onClockOut}>Absen Pulang</button></div>
    </div>
    {clocked && <div className="activate-note"><Check size={18}/><div><strong>Menu SPK aktif</strong><span>Anda dapat mulai memasukkan laporan produksi.</span></div><button onClick={()=>setActive('production')}>Buka SPK</button></div>}
    <div className="panel leave-panel"><div className="panel-head"><h3>Form Izin / Cuti</h3></div>
      <div className="leave-form">
        <label>Jenis Pengajuan<select value={leaveKind} onChange={e=>setLeaveKind(e.target.value)}><option>Izin Sakit</option><option>Cuti / Libur</option></select></label>
        <label>Tanggal<select><option>20 November 2026</option><option>21 November 2026</option></select></label>
        <label>Keterangan<input placeholder="Tulis keterangan..."/></label>
        <button className="primary-btn" onClick={()=>setModal('submitted')}>Ajukan Pengajuan</button>
      </div>
    </div>
    {modal&&<Modal title="Pengajuan Terkirim" onClose={()=>setModal(null)}><div className="success-state"><div><Check/></div><h3>Pengajuan {leaveKind} berhasil</h3><p>Status saat ini: Pending verifikasi Admin.</p><button className="primary-btn full" onClick={()=>setModal(null)}>Selesai</button></div></Modal>}
  </div>;
}

function Production({operator,clocked,setActive,productionApi}) {
  const [kind,setKind]=useState('Tunggal');
  const [modal,setModal]=useState(false);
  const [machine,setMachine]=useState('VMC 850');
  const [item,setItem]=useState('72559');
  const [op,setOp]=useState('OP1');
  const submit=async e=>{
    e.preventDefault();
    const report=await productionApi.rpc('operator_submit_production_report',{
      p_machine:machine,p_item_name:item,p_op_name:op,p_qty_oke:38,p_qty_repair:1,p_qty_ng:0
    });
    if(report)setModal(true);
  };
  if(!clocked) return <div><div className="page-title"><div><span>SPK Produksi</span><h1>Menu belum aktif</h1></div></div><div className="empty-state"><Clock3/><h3>Silakan Absen Masuk terlebih dahulu</h3><p>Menu SPK akan aktif setelah presensi masuk tercatat.</p><button className="primary-btn" onClick={()=>setActive('attendance')}>Ke Halaman Absensi</button></div></div>;
  return <div>
    <div className="page-title"><div><span>SPK Produksi</span><h1>Input Laporan Pekerjaan</h1></div><button className="outline-btn" onClick={()=>setActive('dashboard')}>Kembali</button></div>
    <SyncError error={productionApi.error}/>
    <div className="segmented"><button className={kind==='Tunggal'?'active':''} onClick={()=>setKind('Tunggal')}>Input Tunggal</button><button className={kind==='Gabungan'?'active':''} onClick={()=>setKind('Gabungan')}>Input Gabungan</button></div>
    <form className="panel production-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Nama Operator<input value={operator} disabled/></label>
        <label>Nama Mesin<select value={machine} onChange={e=>setMachine(e.target.value)}>{MACHINES.map(m=><option key={m}>{m}</option>)}</select></label>
        <label>Nama Item / Pekerjaan<select value={item} onChange={e=>setItem(e.target.value)}>{ITEMS.map(i=><option key={i}>{i}</option>)}</select></label>
        <label>Pilihan OP<select value={op} onChange={e=>setOp(e.target.value)}>{['OP1','OP2','OP3','OP4','OP5'].map(o=><option key={o}>{o}</option>)}</select></label>
        <label>Waktu Setting Awal<input type="time" defaultValue="08:00"/></label>
        <label>Cycle Time per OP<div className="inline-fields"><input type="number" defaultValue="2" placeholder="Jam"/><input type="number" defaultValue="15" placeholder="Menit"/></div></label>
        <label>Lama Loading / Unloading<div className="inline-fields"><input type="number" defaultValue="10" placeholder="Menit"/></div></label>
      </div>
      {kind==='Gabungan'&&<label className="wide-label">Pilih mesin tambahan<div className="check-row">{MACHINES.slice(1,4).map(m=><label key={m}><input type="checkbox"/>{m}</label>)}</div></label>}
      <h3>Hasil Produksi</h3>
      <div className="result-grid"><label className="oke"><span>OKE</span><input type="number" defaultValue="38"/></label><label className="repair"><span>Repair</span><input type="number" defaultValue="1"/></label><label className="ng"><span>NG</span><input type="number" defaultValue="0"/></label></div>
      <button className="primary-btn submit-report">Simpan &amp; Kirim Laporan</button>
    </form>
    {modal&&<Modal title="Laporan Terkirim" onClose={()=>setModal(false)}><div className="success-state"><div><Check/></div><h3>Hasil produksi berhasil disimpan</h3><p>Menunggu verifikasi Admin.</p><button className="primary-btn full" onClick={()=>setModal(false)}>Selesai</button></div></Modal>}
  </div>;
}

function OperatorTools({operator}) {
  const [tab,setTab]=useState('Ambil');
  const [machine,setMachine]=useState('VMC 850');
  const [toolId,setToolId]=useState('');
  const [quantity,setQuantity]=useState('1');
  const [itemCondition,setItemCondition]=useState('Baru');
  const [inventory,setInventory]=useState([]);
  const [activeUsage,setActiveUsage]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const refresh=useCallback(async()=>{
    const [inventoryResult,usageResult]=await Promise.all([
      supabase.from('tools_inventory').select('id,tool_name,specification,quantity').order('tool_name'),
      supabase.from('tool_usage')
        .select('id,tool_id,quantity,item_condition,created_at')
        .eq('usage_status','Dipakai').order('created_at',{ascending:false})
    ]);
    const errors=[inventoryResult.error,usageResult.error].filter(Boolean);
    if(errors.length){setError(errors.map(result=>result.message).join(' '));setLoading(false);return;}
    setError('');
    setInventory(inventoryResult.data);
    setActiveUsage(usageResult.data);
    setLoading(false);
  },[]);
  useEffect(()=>{
    refresh();
    const channel=supabase.channel('operator-tools-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'tools_inventory'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'tool_usage'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR')setError('Koneksi realtime tools gagal.');});
    return ()=>{supabase.removeChannel(channel);};
  },[refresh]);
  const takeTool=async event=>{
    event.preventDefault();
    setSaving(true);
    setError('');
    const {error:takeError}=await supabase.rpc('operator_take_tool',{
      p_tool_id:toolId,p_quantity:Number(quantity),p_machine:machine,p_item_condition:itemCondition
    });
    if(takeError){setError(takeError.message);setSaving(false);return;}
    await refresh();
    setToast('Pengambilan tools berhasil dicatat dan stok diperbarui.');
    setSaving(false);
  };
  const returnTool=async (usageId,condition)=>{
    setError('');
    const {error:returnError}=await supabase.rpc('operator_return_tool',{
      p_usage_id:usageId,p_return_condition:condition
    });
    if(returnError){setError(returnError.message);return;}
    await refresh();
    setToast(condition==='Masih Layak / Bekas'
      ? 'Pengembalian dicatat dan stok tersedia ditambahkan kembali.'
      : 'Pengembalian dicatat; tools tidak ditambahkan kembali ke stok.');
  };
  return <div><div className="page-title"><div><span>Manajemen Tools</span><h1>Pengambilan &amp; Pengembalian</h1></div></div>
    <div className="segmented"><button className={tab==='Ambil'?'active':''} onClick={()=>setTab('Ambil')}>Ambil Tools</button><button className={tab==='Kembali'?'active':''} onClick={()=>setTab('Kembali')}>Pengembalian</button><button className={tab==='Serah'?'active':''} onClick={()=>setTab('Serah')}>Serah Terima Shift</button></div>
    <SyncError error={error}/>
    {tab==='Ambil'&&<form className="panel tool-form" onSubmit={takeTool}>
      <div className="form-grid">
        <label>Nama Tools<select required value={toolId} onChange={event=>setToolId(event.target.value)}><option value="">Pilih tools inventori</option>{inventory.map(item=><option key={item.id} value={item.id} disabled={item.quantity===0}>{item.tool_name} · {item.specification} (stok {item.quantity})</option>)}</select></label>
        <label>Mesin Digunakan<select value={machine} onChange={event=>setMachine(event.target.value)}>{MACHINES.map(item=><option key={item}>{item}</option>)}</select></label>
        <label>Jumlah (Qty)<input required type="number" min="1" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
        <label>Status Barang<select value={itemCondition} onChange={event=>setItemCondition(event.target.value)}><option>Baru</option><option>Bekas</option></select></label>
      </div>
      {!loading&&!inventory.length&&!error&&<p className="table-message">Belum ada tools di inventori. Hubungi Admin untuk menambahkan stok.</p>}
      <button className="primary-btn" type="submit" disabled={saving||loading||!inventory.some(item=>item.id===toolId&&item.quantity>0)}>{saving?'Mencatat...':'Ambil Tools & Kurangi Stok'}</button>
    </form>}
    {tab==='Kembali'&&<div className="panel tool-form">
      <div className="panel-head"><h3>Tools yang Sedang Dipakai · {operator}</h3></div>
      {activeUsage.map(usage=>{
        const item=inventory.find(record=>record.id===usage.tool_id);
        return <div className="tool-return-row" key={usage.id}>
          <div><strong>{item?`${item.tool_name} · ${item.specification}`:'Tools'}</strong><span>{usage.quantity} pcs · {usage.item_condition} · {formatAttendanceTimestamp(usage.created_at)}</span></div>
          <div className="condition-grid">{['Tumpul','Patah','Masih Layak / Bekas'].map(condition=><button key={condition} onClick={()=>returnTool(usage.id,condition)}>{condition}</button>)}</div>
        </div>;
      })}
      {!loading&&!activeUsage.length&&!error&&<p className="table-message">Tidak ada tools yang menunggu pengembalian.</p>}
    </div>}
    {tab==='Serah'&&<div className="panel tool-form"><div className="form-grid"><label>Operator Penerima<select>{OPERATORS.map(o=><option key={o}>{o}</option>)}</select></label><label>Shift Tujuan<select><option>Shift 2</option><option>Shift 1</option></select></label><label>Tools yang Diserahkan<input defaultValue="Milling 10 - 1 pcs"/></label><label>Catatan Hasil Kerja<input defaultValue="Hasil sesuai SPK"/></label></div><div className="tool-code"><span>Kode Serah Terima Baru</span><strong>HD-10-AMR-S2-0830</strong></div><button className="primary-btn" onClick={()=>setToast('Serah terima shift berhasil dicatat')}>Konfirmasi Serah Terima</button></div>}
    {toast&&<div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>;
}

function Admin({active}) {
  if(active==='master') return <AdminMaster/>;
  if(active==='inventory') return <AdminInventory/>;
  if(active==='materials') return <AdminMaterials/>;
  if(active==='attendance') return <AdminAttendance/>;
  if(active==='reports') return <AdminReports/>;
  if(active==='production') return <AdminProduction/>;
  return <AdminDashboard setActive={()=>{}}/>;
}

function StatCards() {
  return   <div className="kpi-grid"><div className="kpi-card"><span>Produksi Hari Ini</span><strong>1.284</strong><small className="positive">↑ 8.4% dari kemarin</small></div><div className="kpi-card"><span>Outstanding PO</span><strong>3.450</strong><small>12 pekerjaan aktif</small></div><div className="kpi-card"><span>Efisiensi Tools</span><strong>94%</strong><small className="positive">Irit &amp; Seimbang</small></div><div className="kpi-card"><span>Menunggu Verifikasi</span><strong>18</strong><small className="warning-text-small">Perlu tindakan</small></div></div>;
}

function AdminDashboard({setActive}) {
  return <div><div className="page-title"><div><span>19 November 2026 · Shift 1</span><h1>Ringkasan Operasional</h1></div><button className="outline-btn" onClick={()=>downloadExcel('ringkasan-operasional','Ringkasan',[['Indikator','Nilai'],['Produksi Hari Ini',1284],['Outstanding PO',3450],['Efisiensi Tools','94%'],['Menunggu Verifikasi',18]])}><Download size={16}/> Ekspor Excel</button></div><StatCards/><div className="two-col admin-overview"><div className="panel"><div className="panel-head"><h3>Loading Line Mesin</h3><span className="live-dot">LIVE</span></div>{['VMC 850','VMC 650','HYUNDAI','KASUGA'].map((m,i)=><LoadingLine key={m} item={m} progress={[72,48,86,35][i]} qty={[216,128,172,84][i]+' pcs'}/>)}</div><div className="panel"><div className="panel-head"><h3>Verifikasi Produksi</h3><b>18 pending</b></div><LiveTable compact/></div></div><AdminToolUsageChart/></div>;
}

function AdminToolUsageChart() {
  const [tools,setTools]=useState([]);
  const [usage,setUsage]=useState([]);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    const [toolsResult,usageResult]=await Promise.all([
      supabase.from('tools_inventory').select('id,tool_name,specification'),
      supabase.from('tool_usage').select('tool_id,quantity,usage_status')
    ]);
    const errors=[toolsResult.error,usageResult.error].filter(Boolean);
    if(errors.length){setError(errors.map(result=>result.message).join(' '));return;}
    setError('');
    setTools(toolsResult.data);
    setUsage(usageResult.data);
  },[]);
  useEffect(()=>{
    refresh();
    const channel=supabase.channel('admin-tool-usage-chart')
      .on('postgres_changes',{event:'*',schema:'public',table:'tools_inventory'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'tool_usage'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR')setError('Koneksi realtime bagan pemakaian tools gagal.');});
    return ()=>{supabase.removeChannel(channel);};
  },[refresh]);
  const totals=usage.reduce((result,record)=>{
    const total=result[record.tool_id]||{used:0,active:0};
    total.used+=record.quantity;
    if(record.usage_status==='Dipakai')total.active+=record.quantity;
    result[record.tool_id]=total;
    return result;
  },{});
  const rows=tools.map(tool=>({
    id:tool.id,
    name:tool.tool_name,
    specification:tool.specification,
    ...(totals[tool.id]||{used:0,active:0})
  })).filter(tool=>tool.used>0).sort((a,b)=>b.used-a.used);
  const maximum=Math.max(1,...rows.map(tool=>tool.used));
  return <div className="panel tool-usage-chart">
    <div className="panel-head"><h3>Bagan Pemakaian Tools</h3><span className="live-dot">LIVE</span></div>
    <p className="chart-caption">Jumlah tools yang tercatat dipakai, dibedakan antara masih dipakai dan sudah dikembalikan.</p>
    <SyncError error={error}/>
    {rows.length?<div className="tool-chart-rows">{rows.map(tool=>{
      const activeWidth=(tool.active/maximum)*100;
      const returnedWidth=((tool.used-tool.active)/maximum)*100;
      return <div className="tool-chart-row" key={tool.id}>
        <div className="tool-chart-label"><strong>{tool.name}</strong><span>{tool.specification}</span></div>
        <div className="tool-chart-track" aria-label={`${tool.used} pcs digunakan`}>
          <i className="tool-chart-active" style={{width:`${activeWidth}%`}}/>
          <i className="tool-chart-returned" style={{width:`${returnedWidth}%`}}/>
        </div>
        <b>{tool.used} pcs</b>
      </div>;
    })}</div>:!error?<p className="table-message">Belum ada data pemakaian tools untuk ditampilkan.</p>:null}
    <div className="tool-chart-legend"><span><i className="tool-chart-active"/>Sedang dipakai</span><span><i className="tool-chart-returned"/>Sudah dikembalikan</span></div>
  </div>;
}

function VerificationActions({status,onChange,approveLabel='Verifikasi',rejectLabel='Tidak disetujui'}) {
  if(status!=='Pending') return <span className={'status-badge '+(status==='Terverifikasi'?'verified':'rejected')}>{status}</span>;
  return <div className="verify-actions">
    <button className="verify-approve" onClick={onChange('Terverifikasi')}>{approveLabel}</button>
    <button className="verify-reject" onClick={onChange('Tidak disetujui')}>{rejectLabel}</button>
  </div>;
}

function LiveTableView({records,error,setVerificationStatus,onEdit}) {
  const updateStatus=id=>status=>()=>setVerificationStatus(id,status);
  return <div className="table-wrap"><table>
    <thead><tr><th>SPK</th><th>Operator</th><th>Mesin</th><th>Item</th><th>OP</th><th>OKE</th><th>Repair</th><th>NG</th><th>Verifikasi Pekerjaan</th>{onEdit&&<th>Aksi</th>}</tr></thead>
    <tbody>{records.map(report=><tr key={report.id}>
      <td>{report.code}</td><td>{report.operator}</td><td>{report.machine}</td><td>{report.item}</td><td>{report.op}</td><td>{report.oke}</td><td>{report.repair}</td><td>{report.ng}</td>
      <td><VerificationActions status={report.status} onChange={updateStatus(report.id)}/></td>
      {onEdit&&<td><button className="text-btn" onClick={()=>onEdit(report)}>Edit hasil</button></td>}
    </tr>)}</tbody>
    {error&&<tfoot><tr><td colSpan={onEdit?10:9}><SyncError error={error}/></td></tr></tfoot>}
  </table></div>;
}

function LiveTable() {
  const api=useRemoteRecords('production_reports');
  return <LiveTableView {...api}/>;
}

function AdminProduction() {
  const api=useRemoteRecords('production_reports');
  const [editingReport,setEditingReport]=useState(null);
  const [actualValues,setActualValues]=useState({oke:'0',repair:'0',ng:'0',status:'Pending'});
  const [saving,setSaving]=useState(false);
  const [editError,setEditError]=useState('');
  const openEdit=report=>{
    setEditingReport(report);
    setActualValues({oke:String(report.oke),repair:String(report.repair),ng:String(report.ng),status:report.status});
    setEditError('');
  };
  const saveActualResult=async event=>{
    event.preventDefault();
    setSaving(true);
    setEditError('');
    const status=actualValues.status;
    const {error}=await supabase.from('production_reports').update({
      qty_oke:Number(actualValues.oke),
      qty_repair:Number(actualValues.repair),
      qty_ng:Number(actualValues.ng),
      verification_status:status,
      reviewed_at:status==='Pending'?null:new Date().toISOString()
    }).eq('id',editingReport.id).select('id').single();
    setSaving(false);
    if(error){setEditError(error.message);return;}
    setEditingReport(null);
    await api.refresh();
  };
  const exportRows=[
    ['SPK','Operator','Tanggal','Mesin','Item','OP','OKE','Repair','NG','Status Verifikasi'],
    ...api.records.map(report=>[report.code,report.operator,report.date,report.machine,report.item,report.op,report.oke,report.repair,report.ng,report.status])
  ];
  return <div><div className="page-title"><div><span>Verifikasi &amp; Live Table</span><h1>Produksi &amp; SPK</h1></div><div className="report-actions"><button className="outline-btn" onClick={()=>downloadCsv('laporan-hasil-produksi',exportRows)}><Download size={16}/> CSV</button><button className="primary-btn" onClick={()=>downloadExcel('laporan-hasil-produksi','Produksi',exportRows)}><Download size={16}/> Excel</button></div></div><StatCards/><SyncError error={api.error}/><div className="panel"><div className="panel-head"><h3>Live Table Hasil Produksi</h3><div className="search"><Search size={16}/><input placeholder="Cari SPK / operator"/></div></div><LiveTableView {...api} onEdit={openEdit}/></div>
    {editingReport&&<Modal title={`Koreksi Hasil Aktual · ${editingReport.code}`} wide onClose={()=>setEditingReport(null)}>
      <form className="form-grid" onSubmit={saveActualResult}>
        <p className="edit-result-caption">Masukkan jumlah aktual berdasarkan hasil pemeriksaan untuk {editingReport.operator} · {editingReport.machine} · {editingReport.item}.</p>
        <label>OKE aktual<input required type="number" min="0" step="1" value={actualValues.oke} onChange={event=>setActualValues({...actualValues,oke:event.target.value})}/></label>
        <label>Repair aktual<input required type="number" min="0" step="1" value={actualValues.repair} onChange={event=>setActualValues({...actualValues,repair:event.target.value})}/></label>
        <label>NG aktual<input required type="number" min="0" step="1" value={actualValues.ng} onChange={event=>setActualValues({...actualValues,ng:event.target.value})}/></label>
        <label>Status verifikasi<select value={actualValues.status} onChange={event=>setActualValues({...actualValues,status:event.target.value})}><option>Pending</option><option>Terverifikasi</option><option>Tidak disetujui</option></select></label>
        {editError&&<div className="sync-error form-alert" role="alert">Gagal menyimpan hasil aktual: {editError}</div>}
        <button className="primary-btn full form-submit" type="submit" disabled={saving}>{saving?'Menyimpan...':'Simpan Hasil Aktual'}</button>
      </form>
    </Modal>}
  </div>;
}

function AdminMaster() {
  const api=useMasterDataRecords();
  const [saving,setSaving]=useState(false);
  const [modal,setModal]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [formError,setFormError]=useState('');
  const [form,setForm]=useState({customerName:'',itemName:'',quantity:'',qtyInProgress:'0',qtyShipped:'0',poNumber:''});
  const closeModal=()=>{
    setModal(false);
    setEditingId(null);
    setForm({customerName:'',itemName:'',quantity:'',qtyInProgress:'0',qtyShipped:'0',poNumber:''});
    setFormError('');
  };
  const openEdit=record=>{
    setEditingId(record.id);
    setForm({
      customerName:record.customer_name,
      itemName:record.item_name,
      quantity:String(record.quantity),
      qtyInProgress:String(record.qty_in_progress),
      qtyShipped:String(record.qty_shipped),
      poNumber:record.po_number||''
    });
    setFormError('');
    setModal(true);
  };
  const saveRecord=async event=>{
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const values={
      customer_name:form.customerName.trim(),
      item_name:form.itemName.trim(),
      quantity:Number(form.quantity),
      qty_in_progress:Number(form.qtyInProgress),
      qty_shipped:Number(form.qtyShipped),
      po_number:form.poNumber.trim()||null
    };
    const result=editingId
      ? await supabase.from('master_data').update(values).eq('id',editingId).select('id').single()
      : await supabase.from('master_data').insert(values);
    if(result.error){setFormError(result.error.message);setSaving(false);return;}
    await api.refresh();
    setSaving(false);
    closeModal();
  };
  return <div>
    <div className="page-title"><div><span>Konfigurasi Sistem</span><h1>Master Data</h1></div><button className="primary-btn" onClick={()=>setModal(true)}><Plus size={16}/> Tambah Data</button></div>
    <SyncError error={api.error}/>
    <div className="panel"><div className="panel-head"><h3>Customer &amp; Item</h3></div><div className="table-wrap"><table>
      <thead><tr><th>Nama Customer</th><th>Nama Produk</th><th>Target</th><th>Hasil Berjalan</th><th>Terkirim</th><th>Outstanding</th><th>Nomor PO</th><th>Aksi</th></tr></thead>
      <tbody>{api.records.map(record=><tr key={record.id}><td>{record.customer_name}</td><td>{record.item_name}</td><td>{record.quantity} pcs</td><td>{record.qty_in_progress} pcs</td><td>{record.qty_shipped} pcs</td><td><strong>{Math.max(0,record.quantity-record.qty_shipped)} pcs</strong></td><td>{record.po_number||'—'}</td><td><button className="text-btn" onClick={()=>openEdit(record)}>Edit</button></td></tr>)}</tbody>
    </table>{api.loading&&<p className="table-message">Memuat data...</p>}{!api.loading&&!api.records.length&&!api.error&&<p className="table-message">Belum ada data. Klik “Tambah Data” untuk memulai.</p>}</div></div>
    {modal&&<Modal title={editingId?'Edit Data Master':'Tambah Data Master'} wide onClose={closeModal}>
      <form className="form-grid" onSubmit={saveRecord}>
        {formError&&<div className="sync-error form-alert" role="alert">Gagal menyimpan: {formError}</div>}
        <label>Nama Customer<input required value={form.customerName} onChange={event=>setForm({...form,customerName:event.target.value})} placeholder="Masukkan nama customer"/></label>
        <label>Nama Produk / Item<input required value={form.itemName} onChange={event=>setForm({...form,itemName:event.target.value})} placeholder="Masukkan nama produk"/></label>
        <label>Target Pesanan (pcs)<input required type="number" min="0" step="1" value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})} placeholder="Jumlah target"/></label>
        <label>Hasil Berjalan (pcs)<input required type="number" min="0" step="1" value={form.qtyInProgress} onChange={event=>setForm({...form,qtyInProgress:event.target.value})} placeholder="Jumlah produksi berjalan"/></label>
        <label>Sudah Terkirim (pcs)<input required type="number" min="0" step="1" value={form.qtyShipped} onChange={event=>setForm({...form,qtyShipped:event.target.value})} placeholder="Jumlah sudah terkirim"/></label>
        <label>Nomor PO (opsional)<input value={form.poNumber} onChange={event=>setForm({...form,poNumber:event.target.value})} placeholder="Boleh dikosongkan"/></label>
        <button className="primary-btn full form-submit" type="submit" disabled={saving}>{saving?'Menyimpan...':'Simpan Data'}</button>
      </form>
    </Modal>}
  </div>;
}

function AdminMaterials() {
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [modal,setModal]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({
    customerName:'',materialName:'',materialSize:'',productName:'',
    unit:'pcs',quantity:'',equivalentPcs:''
  });
  const refresh=useCallback(async()=>{
    const {data,error:queryError}=await supabase.from('material_inventory')
      .select('id,customer_name,material_name,material_size,product_name,quantity_pcs,quantity_bars,equivalent_pcs')
      .order('created_at',{ascending:false});
    if(queryError){setError(queryError.message);setLoading(false);return;}
    setError('');
    setRecords(data);
    setLoading(false);
  },[]);
  useEffect(()=>{
    refresh();
    const channel=supabase.channel('admin-material-inventory')
      .on('postgres_changes',{event:'*',schema:'public',table:'material_inventory'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR')setError('Koneksi realtime inventori material gagal.');});
    return ()=>{supabase.removeChannel(channel);};
  },[refresh]);
  const closeModal=()=>{
    setModal(false);
    setEditingId(null);
    setForm({customerName:'',materialName:'',materialSize:'',productName:'',unit:'pcs',quantity:'',equivalentPcs:''});
  };
  const openEdit=record=>{
    const unit=record.quantity_bars>0?'batang':'pcs';
    setEditingId(record.id);
    setForm({
      customerName:record.customer_name,
      materialName:record.material_name,
      materialSize:record.material_size,
      productName:record.product_name,
      unit,
      quantity:String(unit==='batang'?record.quantity_bars:record.quantity_pcs),
      equivalentPcs:String(record.equivalent_pcs)
    });
    setModal(true);
  };
  const saveMaterial=async event=>{
    event.preventDefault();
    setSaving(true);
    setError('');
    const quantity=Number(form.quantity);
    const values={
      customer_name:form.customerName.trim(),
      material_name:form.materialName.trim(),
      material_size:form.materialSize.trim(),
      product_name:form.productName.trim(),
      quantity_pcs:form.unit==='pcs'?quantity:0,
      quantity_bars:form.unit==='batang'?quantity:0,
      equivalent_pcs:form.unit==='pcs'?quantity:Number(form.equivalentPcs)
    };
    const result=editingId
      ? await supabase.from('material_inventory').update(values).eq('id',editingId).select('id').single()
      : await supabase.from('material_inventory').insert(values);
    if(result.error){setError(result.error.message);setSaving(false);return;}
    await refresh();
    setSaving(false);
    closeModal();
  };
  return <div>
    <div className="page-title"><div><span>Stok Bahan Baku</span><h1>Inventori Material</h1></div><button className="primary-btn" onClick={()=>setModal(true)}><Plus size={16}/> Tambah Material</button></div>
    <SyncError error={error}/>
    <div className="panel"><div className="panel-head"><h3>Daftar Material</h3></div><div className="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Nama Bahan</th><th>Ukuran Bahan</th><th>Nama Produk</th><th>Jumlah (pcs)</th><th>Jumlah (batang)</th><th>Ekuivalen Total (pcs)</th><th>Aksi</th></tr></thead>
      <tbody>{records.map(record=><tr key={record.id}>
        <td>{record.customer_name}</td><td>{record.material_name}</td><td>{record.material_size}</td><td>{record.product_name}</td>
        <td>{record.quantity_pcs}</td><td>{record.quantity_bars}</td><td>{record.equivalent_pcs}</td>
        <td><button className="text-btn" onClick={()=>openEdit(record)}>Edit</button></td>
      </tr>)}</tbody>
    </table>{loading&&<p className="table-message">Memuat data material...</p>}{!loading&&!records.length&&!error&&<p className="table-message">Belum ada material. Klik “Tambah Material” untuk memulai.</p>}</div></div>
    {modal&&<Modal title={editingId?'Edit Material':'Tambah Material'} wide onClose={closeModal}>
      <form className="form-grid" onSubmit={saveMaterial}>
        {error&&<div className="sync-error form-alert" role="alert">Gagal menyimpan material: {error}</div>}
        <label>Nama Customer<input required value={form.customerName} onChange={event=>setForm({...form,customerName:event.target.value})}/></label>
        <label>Nama Bahan<input required value={form.materialName} onChange={event=>setForm({...form,materialName:event.target.value})}/></label>
        <label>Ukuran Bahan<input required value={form.materialSize} onChange={event=>setForm({...form,materialSize:event.target.value})} placeholder="Contoh: Ø10 x 6000 mm"/></label>
        <label>Nama Produk<input required value={form.productName} onChange={event=>setForm({...form,productName:event.target.value})}/></label>
        <label>Satuan Material<select value={form.unit} onChange={event=>setForm({...form,unit:event.target.value})}><option value="pcs">Pcs</option><option value="batang">Batang</option></select></label>
        <label>Jumlah {form.unit==='pcs'?'(pcs)':'(batang)'}<input required type="number" min={form.unit==='batang'?'1':'0'} step="1" value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})}/></label>
        {form.unit==='batang'&&<label>Ekuivalen total (pcs)<input required type="number" min="1" step="1" value={form.equivalentPcs} onChange={event=>setForm({...form,equivalentPcs:event.target.value})} placeholder="Total pcs dari seluruh batang"/></label>}
        <button className="primary-btn full form-submit" type="submit" disabled={saving}>{saving?'Menyimpan...':'Simpan Material'}</button>
      </form>
    </Modal>}
  </div>;
}

function AdminInventory() {
  const [records,setRecords]=useState([]);
  const [activeUsage,setActiveUsage]=useState([]);
  const [usageHistory,setUsageHistory]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [modal,setModal]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({toolName:'',specification:'',quantity:''});
  const refresh=useCallback(async()=>{
    const [inventoryResult,activeResult,historyResult]=await Promise.all([
      supabase.from('tools_inventory')
        .select('id,tool_name,specification,quantity').order('created_at',{ascending:false}),
      supabase.from('tool_usage').select('id,tool_id,quantity')
        .eq('usage_status','Dipakai'),
      supabase.from('tool_usage')
        .select('id,tool_id,operator_name,machine,quantity,item_condition,usage_status,return_condition,created_at,returned_at')
        .order('created_at',{ascending:false}).limit(100)
    ]);
    const errors=[inventoryResult.error,activeResult.error,historyResult.error].filter(Boolean);
    if(errors.length){setError(errors.map(result=>result.message).join(' '));setLoading(false);return;}
    setError('');
    setRecords(inventoryResult.data);
    setActiveUsage(activeResult.data);
    setUsageHistory(historyResult.data);
    setLoading(false);
  },[]);
  useEffect(()=>{
    refresh();
    const channel=supabase.channel('admin-tools-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'tools_inventory'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'tool_usage'},refresh)
      .subscribe(status=>{if(status==='CHANNEL_ERROR')setError('Koneksi realtime inventori tools gagal.');});
    return ()=>{supabase.removeChannel(channel);};
  },[refresh]);
  const closeModal=()=>{
    setModal(false);
    setEditingId(null);
    setForm({toolName:'',specification:'',quantity:''});
  };
  const openEdit=record=>{
    setEditingId(record.id);
    setForm({toolName:record.tool_name,specification:record.specification,quantity:String(record.quantity)});
    setModal(true);
  };
  const saveTool=async event=>{
    event.preventDefault();
    setSaving(true);
    setError('');
    const values={
      tool_name:form.toolName.trim(),
      specification:form.specification.trim(),
      quantity:Number(form.quantity)
    };
    const result=editingId
      ? await supabase.from('tools_inventory').update(values).eq('id',editingId).select('id').single()
      : await supabase.from('tools_inventory').insert(values);
    if(result.error){setError(result.error.message);setSaving(false);return;}
    await refresh();
    setSaving(false);
    closeModal();
  };
  const activeQuantity=activeUsage.reduce((total,usage)=>total+usage.quantity,0);
  const activeByTool=activeUsage.reduce((totals,usage)=>{
    totals[usage.tool_id]=(totals[usage.tool_id]||0)+usage.quantity;
    return totals;
  },{});
  return <div>
    <div className="page-title"><div><span>Stok &amp; Tracking</span><h1>Inventori Tools</h1></div><button className="primary-btn" onClick={()=>setModal(true)}><Plus size={16}/> Tambah Item</button></div>
    <div className="kpi-grid"><div className="kpi-card"><span>Total Jenis Tools</span><strong>{records.length}</strong></div><div className="kpi-card"><span>Stok Tersedia</span><strong>{records.reduce((total,record)=>total+record.quantity,0)}</strong><small>pcs</small></div><div className="kpi-card"><span>Pemakaian Aktif</span><strong>{activeQuantity}</strong><small>pcs sedang dipakai operator</small></div></div>
    <SyncError error={error}/>
    <div className="panel"><div className="panel-head"><h3>Stok Inventori</h3></div><div className="table-wrap"><table><thead><tr><th>Nama Tools</th><th>Spesifikasi</th><th>Stok Tersedia</th><th>Pemakaian Aktif</th><th>Aksi</th></tr></thead><tbody>{records.map(record=><tr key={record.id}><td>{record.tool_name}</td><td>{record.specification}</td><td>{record.quantity} pcs</td><td>{activeByTool[record.id]||0} pcs</td><td><button className="text-btn" onClick={()=>openEdit(record)}>Edit</button></td></tr>)}</tbody></table>{loading&&<p className="table-message">Memuat data...</p>}{!loading&&!records.length&&!error&&<p className="table-message">Belum ada item. Klik “Tambah Item” untuk memulai.</p>}</div></div>
    <div className="panel tool-history-panel"><div className="panel-head"><h3>Riwayat Pemakaian Tools</h3></div><div className="table-wrap"><table><thead><tr><th>Waktu Ambil</th><th>Nama Tools</th><th>Operator</th><th>Mesin</th><th>Qty</th><th>Kondisi Ambil</th><th>Status</th><th>Kondisi Kembali</th><th>Waktu Kembali</th></tr></thead><tbody>{usageHistory.map(usage=>{
      const item=records.find(record=>record.id===usage.tool_id);
      return <tr key={usage.id}><td>{formatAttendanceTimestamp(usage.created_at)}</td><td>{item?`${item.tool_name} · ${item.specification}`:'Tools'}</td><td>{usage.operator_name}</td><td>{usage.machine}</td><td>{usage.quantity} pcs</td><td>{usage.item_condition}</td><td>{usage.usage_status}</td><td>{usage.return_condition||'—'}</td><td>{formatAttendanceTimestamp(usage.returned_at)}</td></tr>;
    })}</tbody></table>{!loading&&!usageHistory.length&&!error&&<p className="table-message">Belum ada transaksi pemakaian tools.</p>}</div></div>
    {modal&&<Modal title={editingId?'Edit Tools':'Tambah Item Tools'} onClose={closeModal}>
      <form className="form-grid" onSubmit={saveTool}>
        {error&&<div className="sync-error form-alert" role="alert">Gagal menyimpan: {error}</div>}
        <label>Nama Tools<input required value={form.toolName} onChange={event=>setForm({...form,toolName:event.target.value})} placeholder="Masukkan nama tools"/></label>
        <label>Spesifikasi<input required value={form.specification} onChange={event=>setForm({...form,specification:event.target.value})} placeholder="Masukkan spesifikasi"/></label>
        <label>Jumlah<input required type="number" min="0" step="1" value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})} placeholder="Masukkan jumlah"/></label>
        <button className="primary-btn full form-submit" type="submit" disabled={saving}>{saving?'Menyimpan...':'Simpan Item'}</button>
      </form>
    </Modal>}
  </div>;
}

function AdminAttendance() {
  const attendanceApi=useRemoteRecords('attendance_records');
  const attendanceRecords=attendanceApi.records;
  const today=getLocalDateKey();
  const todayLabel=new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
  const presentRecords=attendanceRecords.filter(record=>record.date===today&&record.checkIn);
  const pendingCount=presentRecords.filter(record=>record.status==='Pending').length;
  const updateStatus=id=>status=>()=>attendanceApi.setVerificationStatus(id,status);
  return <div>
    <div className="page-title">
      <div><span>Absensi Operator · {todayLabel}</span><h1>Absensi &amp; Lembur</h1></div>
      <button className="outline-btn"><Download size={16}/> Sinkron Ulang</button>
    </div>
    <SyncError error={attendanceApi.error}/>
    <div className="kpi-grid">
      <div className="kpi-card"><span>Hadir Hari Ini</span><strong>{presentRecords.length} / {OPERATORS.length}</strong></div>
      <div className="kpi-card"><span>Izin / Cuti</span><strong>2</strong></div>
      <div className="kpi-card"><span>Jam Lembur</span><strong>38 jam</strong></div>
      <div className="kpi-card"><span>Pending Verifikasi</span><strong>{pendingCount}</strong></div>
    </div>
    <div className="panel">
      <div className="panel-head"><h3>Rekap Kehadiran Operator</h3><select><option>Minggu Ini</option></select></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Tanggal</th><th>Absen Masuk (WIB)</th><th>Absen Pulang (WIB)</th><th>Status / Aksi</th></tr></thead>
        <tbody>{OPERATORS.map(operator=>{
          const record=attendanceRecords.find(item=>item.operator===operator&&item.date===today);
          const status=record?.checkIn?record.status:'Belum Absen';
          return <tr key={operator}>
            <td><strong>{operator}</strong></td><td>{record?.date||'—'}</td>
            <td>{formatAttendanceTimestamp(record?.checkIn)}</td><td>{formatAttendanceTimestamp(record?.checkOut)}</td>
            <td>{record?.checkIn
              ? <VerificationActions status={status} onChange={updateStatus(record.id)} approveLabel="Setuju" rejectLabel="Tidak"/>
              : <span className="status-badge neutral">Belum Absen</span>}
            </td>
          </tr>;
        })}</tbody>
      </table></div>
    </div>
  </div>;
}

function AdminReports() {
  const [productionPeriod,setProductionPeriod]=useState('2026-11');
  const [attendancePeriod,setAttendancePeriod]=useState('2026-11');
  const [payrollPeriod,setPayrollPeriod]=useState('2026-W47');
  const [payrollTimestamp,setPayrollTimestamp]=useState('');
  const [operator,setOperator]=useState(OPERATORS[0]);
  const productionApi=useRemoteRecords('production_reports');
  const attendanceApi=useRemoteRecords('attendance_records');
  const attendanceRecords=attendanceApi.records;
  const productionRows=[
    ['SPK','Operator','Tanggal','Mesin','Item','OP','OKE','Repair','NG','Status Verifikasi'],
    ...productionApi.records.filter(record=>record.date.startsWith(productionPeriod)).map(report=>[
      report.code,report.operator,report.date,report.machine,report.item,report.op,report.oke,report.repair,report.ng,report.status
    ])
  ];
  const periodAttendance=attendanceRecords.filter(record=>record.date.startsWith(attendancePeriod));
  const attendanceRows=[
    ['Operator','Tanggal','Absen Masuk (WIB)','Absen Pulang (WIB)','Status Verifikasi'],
    ...periodAttendance.map(record=>[
      record.operator,record.date,formatAttendanceTimestamp(record.checkIn),formatAttendanceTimestamp(record.checkOut),
      record.status||'Pending'
    ])
  ];
  const weekDates=getWeekDates(payrollPeriod);
  const weeklyAttendance=attendanceRecords.filter(record=>record.operator===operator&&record.date>=weekDates.start&&record.date<=weekDates.end);
  const downloadPayrollSlip=()=>{
    const timestamp=new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'full',timeStyle:'medium'});
    setPayrollTimestamp(timestamp);
    downloadExcel(`slip-gaji-${operator.toLowerCase().replaceAll(' ','-')}-${payrollPeriod}`,'Slip Gaji',[
      ['Slip Gaji - Rekap Mingguan'],
      ['Periode',payrollPeriod],
      ['Tanggal Mulai',weekDates.start],
      ['Tanggal Selesai',weekDates.end],
      ['Dicetak pada (WIB)',timestamp],
      ['Operator',operator],
      ['Total Hari Hadir',weeklyAttendance.filter(record=>record.checkIn).length],
      ['Tanggal','Absen Masuk (WIB)','Absen Pulang (WIB)','Status Verifikasi'],
      ...(weeklyAttendance.length
        ? weeklyAttendance.map(record=>[
          record.date,formatAttendanceTimestamp(record.checkIn),formatAttendanceTimestamp(record.checkOut),
          record.status||'Pending'
        ])
        : [['—','Belum ada catatan absensi pada minggu ini','—','—']]),
      ['Jam Lembur','Belum ada data pencatatan lembur.'],
      ['Catatan Gaji','Nominal gaji belum dihitung karena tarif gaji belum dikonfigurasi.']
    ]);
  };
  return <div>
    <div className="page-title"><div><span>Ekspor &amp; Analisis</span><h1>Laporan</h1></div></div>
    <SyncError error={productionApi.error||attendanceApi.error}/>
    <div className="report-grid">
      <div className="panel"><h3>Laporan Produksi</h3><p>Laporan hasil SPK aktual per item dan mesin.</p>
        <label>Periode<input type="month" value={productionPeriod} onChange={event=>setProductionPeriod(event.target.value)}/></label>
        <div className="report-actions">
          <button className="outline-btn" onClick={()=>downloadCsv(`laporan-produksi-${productionPeriod}`,productionRows)}><Download size={16}/> CSV</button>
          <button className="primary-btn" onClick={()=>downloadExcel(`laporan-produksi-${productionPeriod}`,'Produksi',productionRows)}><Download size={16}/> Excel</button>
        </div>
      </div>
      <div className="panel"><h3>Laporan Absensi</h3><p>Rekap mingguan dan bulanan.</p>
        <label>Periode<input type="month" value={attendancePeriod} onChange={event=>setAttendancePeriod(event.target.value)}/></label>
        <div className="report-actions">
          <button className="outline-btn" onClick={()=>downloadCsv(`laporan-absensi-${attendancePeriod}`,attendanceRows)}><Download size={16}/> CSV</button>
          <button className="primary-btn" onClick={()=>downloadExcel(`laporan-absensi-${attendancePeriod}`,'Absensi',attendanceRows)}><Download size={16}/> Excel</button>
        </div>
      </div>
      <div className="panel"><h3>Slip Gaji</h3><p>Rekap kehadiran dan lembur operator.</p>
        <label>Periode Mingguan<input type="week" value={payrollPeriod} onChange={event=>setPayrollPeriod(event.target.value)}/></label>
        {weekDates.start&&<p className="period-caption">{weekDates.start} s/d {weekDates.end}</p>}
        <label>Pilih Operator<select value={operator} onChange={event=>setOperator(event.target.value)}>{OPERATORS.map(name=><option key={name}>{name}</option>)}</select></label>
        <div className="report-actions"><button className="primary-btn" onClick={downloadPayrollSlip}><Download size={16}/> Unduh Slip Excel</button></div>
        {payrollTimestamp&&<p className="period-caption">Terakhir dibuat: {payrollTimestamp} WIB</p>}
      </div>
    </div>
  </div>;
}

function Boss({active}) {
  if(active==='production') return <BossProduction/>;
  if(active==='performance') return <BossPerformance/>;
  if(active==='tools') return <BossTools/>;
  if(active==='reports') return <AdminReports/>;
  return <div><div className="page-title"><div><span>19 November 2026 · Real-Time</span><h1>Executive Overview</h1></div><button className="outline-btn" onClick={()=>downloadExcel('ringkasan-eksekutif','Ringkasan', [['Indikator','Nilai'],['Progress Produksi','78%'],['Barang Terkirim',8420],['Efisiensi Operator','91%'],['PO Aktif',12]])}><Download size={16}/> Unduh Ringkasan Excel</button></div><div className="kpi-grid"><div className="kpi-card"><span>Progress Produksi</span><strong>78%</strong><small className="positive">↑ 6% target bulan ini</small></div><div className="kpi-card"><span>Barang Terkirim</span><strong>8.420</strong><small>PCS bulan ini</small></div><div className="kpi-card"><span>Efisiensi Operator</span><strong>91%</strong><small className="positive">Di atas target</small></div><div className="kpi-card"><span>PO Aktif</span><strong>12</strong><small>3 mendekati deadline</small></div></div><div className="two-col admin-overview"><div className="panel"><div className="panel-head"><h3>Progres PO Utama</h3><button>Lihat Semua</button></div>{[['PO-HLX-2511','72559','68%'],['PO-PND-2518','H122-AD1-9810','42%'],['PO-AST-2204','RUMAH KONIS','81%']].map(r=><LoadingLine key={r[0]} item={r[0]+` · ${r[1]}`} progress={parseInt(r[2])} qty={r[2]+'/100 pcs'}/>)}</div><div className="panel"><div className="panel-head"><h3>Performa Operator</h3></div><div className="bars">{[['AMRI',92],['M. RIPAI',78],['ERWIN',86],['AGUS',73],['SIGIT',68],['HAFIDZ',81]].map(([n,v])=><div className="bar-row" key={n}><span>{n}</span><div><i style={{height:v+'%'}}/></div><b>{v}%</b></div>)}</div></div></div></div>;
}

function BossProduction() {
  const productionApi=useRemoteRecords('production_reports');
  const rows=[
    ['PO-HLX-2511','PT. HILEX','72559','4.500','68%','3.060','Terverifikasi','22 Nov'],
    ['PO-PND-2518','PT. Pindad','H122-AD1-9810','2.800','42%','1.176','Sebagian','24 Nov'],
    ['PO-AST-2204','PT. Astra Otoparts','RUMAH KONIS','3.200','81%','2.592','Terverifikasi','20 Nov']
  ];
  const exportRows=[['Nomor PO','Customer','Item','Target','Progres','Terkirim','Status Verifikasi','Estimasi Finish'],...rows];
  const productionRows=[
    ['SPK','Operator','Mesin','Item','OP','OKE','Repair','NG','Waktu Input','Verifikasi'],
    ...productionApi.records.map(report=>[
      report.code,report.operator,report.machine,report.item,report.op,report.oke,report.repair,report.ng,report.time,report.status
    ])
  ];
  return <div><div className="page-title"><div><span>Monitoring PO Real-Time</span><h1>Progres Produksi</h1></div><div className="report-actions"><button className="outline-btn" onClick={()=>downloadCsv('progres-po',exportRows)}><Download size={16}/> PO CSV</button><button className="primary-btn" onClick={()=>downloadExcel('progres-po','Progres PO',exportRows)}><Download size={16}/> PO Excel</button></div></div><SyncError error={productionApi.error}/><div className="panel"><div className="panel-head"><h3>Daftar PO Aktif</h3><span className="live-dot">LIVE</span></div><div className="table-wrap"><table><thead><tr><th>PO / Customer</th><th>Item</th><th>Target</th><th>Progres</th><th>Terkirim</th><th>Status Verifikasi</th><th>Estimasi Finish</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td><strong>{r[0]}</strong><small>{r[1]}</small></td><td>{r[2]}</td><td>{r[3]}</td><td><div className="table-progress"><i style={{width:r[4]}}/><span>{r[4]}</span></div></td><td>{r[5]} pcs</td><td><span className={'status-badge '+(r[6]==='Terverifikasi'?'verified':'pending')}>{r[6]}</span></td><td>{r[7]} Nov</td></tr>)}</tbody></table></div></div><div className="panel live-report-panel"><div className="panel-head"><h3>Hasil Produksi Operator</h3><div className="report-actions"><button className="outline-btn" onClick={()=>downloadCsv('hasil-produksi-operator',productionRows)}><Download size={16}/> CSV</button><button className="primary-btn" onClick={()=>downloadExcel('hasil-produksi-operator','Produksi',productionRows)}><Download size={16}/> Excel</button></div></div><div className="table-wrap"><table><thead><tr>{productionRows[0].map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{productionApi.records.map(report=><tr key={report.id}><td>{report.code}</td><td>{report.operator}</td><td>{report.machine}</td><td>{report.item}</td><td>{report.op}</td><td>{report.oke}</td><td>{report.repair}</td><td>{report.ng}</td><td>{report.time}</td><td><span className={'status-badge '+(report.status==='Terverifikasi'?'verified':report.status==='Pending'?'pending':'rejected')}>{report.status}</span></td></tr>)}</tbody></table></div></div></div>;
}

function BossPerformance() {
  const rows=[['AMRI','284','4','8','2','12 menit','94%','↑'],['M. RIPAI','242','5','7','1','16 menit','89%','↓'],['ERWIN','238','3','6','2','14 menit','91%','↑'],['AGUS','210','2','9','1','21 menit','84%','—'],['SIGIT','186','3','7','1','24 menit','81%','↓'],['HAFIDZ','124','1','5','1','18 menit','87%','↑']];
  const exportRows=[['Operator','OKE','Repair','NG','Mesin Aktif','Setting Rata-rata','Efisiensi','Tren'],...rows];
  return <div><div className="page-title"><div><span>Kinerja &amp; Produktivitas</span><h1>Performa Operator</h1></div><div className="report-actions"><button className="outline-btn" onClick={()=>downloadCsv('performa-operator',exportRows)}><Download size={16}/> CSV</button><button className="primary-btn" onClick={()=>downloadExcel('performa-operator','Performa',exportRows)}><Download size={16}/> Excel</button></div></div><div className="kpi-grid"><div className="kpi-card"><span>Target Harian Tercapai</span><strong>82%</strong></div><div className="kpi-card"><span>Rata-rata Setting</span><strong>18 menit</strong></div><div className="kpi-card"><span>Total OKE</span><strong>1.284</strong></div><div className="kpi-card"><span>Total NG / Repair</span><strong>42 / 18</strong></div></div><div className="panel"><div className="table-wrap"><table><thead><tr><th>Operator</th><th>OKE</th><th>Repair</th><th>NG</th><th>Mesin Aktif</th><th>Setting Rata-rata</th><th>Efisiensi</th><th>Tren</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map((c,j)=><td key={j}>{j===6?<span className="status-badge verified">{c}</span>:c}</td>)}</tr>)}</tbody></table></div></div></div>;
}

function BossTools() {
  const rows=[['AMRI','24','22','28','Irit','2 pcs'],['M. RIPAI','31','29','30','Seimbang','2 pcs'],['ERWIN','26','24','28','Irit','2 pcs'],['AGUS','38','31','32','Boros','7 pcs'],['SIGIT','29','27','30','Seimbang','2 pcs'],['HAFIDZ','20','18','24','Irit','2 pcs']];
  const exportRows=[['Operator','Tools Dipakai','Tools Dikembalikan','Standar / OP','Indikator','Tools Aktif'],...rows];
  return <div><div className="page-title"><div><span>Audit Pemakaian</span><h1>Efisiensi Tools</h1></div><div className="report-actions"><button className="outline-btn" onClick={()=>downloadCsv('efisiensi-tools',exportRows)}><Download size={16}/> CSV</button><button className="primary-btn" onClick={()=>downloadExcel('efisiensi-tools','Tools',exportRows)}><Download size={16}/> Excel</button></div></div><div className="kpi-grid"><div className="kpi-card"><span>Kategori Irit</span><strong>3 Operator</strong></div><div className="kpi-card"><span>Seimbang</span><strong>2 Operator</strong></div><div className="kpi-card"><span>Boros</span><strong>1 Operator</strong></div><div className="kpi-card"><span>Tools Aktif</span><strong>34 pcs</strong></div></div><div className="panel"><div className="table-wrap"><table><thead><tr><th>Operator</th><th>Tools Dipakai</th><th>Tools Dikembalikan</th><th>Standar / OP</th><th>Indikator</th><th>Tools Aktif</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map((c,j)=><td key={j}>{j===4?<span className={'tool-indicator '+c.toLowerCase()}>{c}</span>:c}</td>)}</tr>)}</tbody></table></div></div></div>;
}

function CloudSetup() {
  return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><TriangleAlert/></div>
    <h2>Backend belum dikonfigurasi</h2>
    <p>Aplikasi tidak menggunakan penyimpanan lokal. Hubungkan proyek Supabase untuk masuk dan menyimpan data bersama.</p>
    <div className="setup-instructions"><strong>Atur environment variables:</strong><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><span>Isi di .env.local untuk pengembangan atau Environment Variables Vercel untuk publikasi.</span></div>
  </div></div>;
}

function App() {
  const [portal,setPortal]=useState(null);
  const [auth,setAuth]=useState({loading:true,session:null,profile:null,error:''});
  useEffect(()=>{
    if(!supabase){setAuth({loading:false,session:null,profile:null,error:''});return;}
    let active=true;
    const loadProfile=async session=>{
      if(!session){if(active)setAuth({loading:false,session:null,profile:null,error:''});return;}
      const {data:profile,error}=await supabase.from('profiles').select('role,display_name').eq('id',session.user.id).single();
      if(active)setAuth({loading:false,session,profile:profile||null,error:error?.message||''});
    };
    supabase.auth.getSession().then(({data,error})=>{
      if(error){if(active)setAuth({loading:false,session:null,profile:null,error:error.message});return;}
      loadProfile(data.session);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session){if(active)setAuth({loading:false,session:null,profile:null,error:''});return;}
      setTimeout(()=>loadProfile(session),0);
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  if(!supabase)return <CloudSetup/>;
  if(auth.loading)return <div className="login-page"><div className="login-card">Menghubungkan ke Supabase...</div></div>;
  if(auth.session&&!auth.profile)return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><TriangleAlert/></div><h2>Profil akses belum tersedia</h2>
    <p>{auth.error||'Akun Supabase ini belum memiliki profil portal.'}</p>
    <button className="outline-btn" onClick={()=>supabase.auth.signOut()}>Keluar</button>
  </div></div>;
  if(auth.session&&auth.profile){
    const role=auth.profile.role.toUpperCase();
    const logout=async()=>{
      const {error}=await supabase.auth.signOut();
      if(error)setAuth(current=>({...current,error:error.message}));
      else setPortal(null);
    };
    return <AppShell role={role} profile={auth.profile} onLogout={logout}>
      {role==='OPERATOR'?<Operator/>:role==='ADMIN'?<Admin/>:<Boss/>}
    </AppShell>;
  }
  if(!portal)return <PortalSelect onSelect={setPortal}/>;
  return <Login role={portal} onLogin={(profile,session)=>setAuth({loading:false,session,profile,error:''})} onBack={()=>setPortal(null)}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
