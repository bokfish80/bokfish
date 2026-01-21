
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { Search, Calendar, ChevronRight, TrendingUp, Sparkles, UserCheck, LayoutGrid, Users, GraduationCap, ChevronLeft, ShieldCheck, Lock, Unlock, X, Cloud, Share2, QrCode, ArrowRight, Info, CheckCircle2, AlertCircle, Check, Heart, Wifi, WifiOff, RefreshCw, Smartphone, Save } from 'lucide-react';

const DEVICE_ID = Math.random().toString(36).substring(7);
const BUCKET_KEY = "skp_v4_relay"; 

const App: React.FC = () => {
  const STORAGE_KEY_PREFIX = 'sg_pro_v4_';
  
  const getUrlKey = () => {
    try {
      return new URLSearchParams(window.location.search).get('key');
    } catch (e) {
      return null;
    }
  };

  const [syncKey, setSyncKey] = useState<string>(() => {
    try {
      return getUrlKey() || localStorage.getItem(STORAGE_KEY_PREFIX + 'last_key') || '';
    } catch (e) {
      return '';
    }
  });
  
  const [isSetup, setIsSetup] = useState<boolean>(!!syncKey);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  const lastUpdateAtRef = useRef<number>(0);
  const isUpdatingFromRemote = useRef<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'idle'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [password, setPassword] = useState('');

  // 클라우드 데이터 가져오기 (Pull)
  const fetchFromCloud = useCallback(async (isManual = false) => {
    if (!syncKey || !isSetup) return;
    const url = `https://kvdb.io/AnV9v8pB3vB6g7r9q8zX1/${BUCKET_KEY}_${syncKey}`;
    
    if (isManual) setSyncStatus('syncing');
    
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (!text) {
          if (isManual) setSyncStatus('connected');
          return;
        }
        
        try {
          const data = JSON.parse(text);
          if (data && data.updatedBy !== DEVICE_ID && data.timestamp > lastUpdateAtRef.current) {
            isUpdatingFromRemote.current = true;
            setAttendance(data.attendance || {});
            setStudents(data.students || []);
            setViolations(data.violations || DEFAULT_VIOLATIONS);
            lastUpdateAtRef.current = data.timestamp;
            setLastSyncTime(new Date().toLocaleTimeString());
            setSyncStatus('connected');
            setHasUnsavedChanges(false);
          } else if (isManual) {
            setSyncStatus('connected');
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        } catch (parseError) {
          if (isManual) setSyncStatus('error');
        }
      }
    } catch (e) {
      if (isManual) setSyncStatus('error');
    }
  }, [syncKey, isSetup]);

  // 클라우드로 데이터 전송 (Push)
  const pushToCloud = useCallback(async (force = false) => {
    if (!syncKey || !isSetup) return;
    const url = `https://kvdb.io/AnV9v8pB3vB6g7r9q8zX1/${BUCKET_KEY}_${syncKey}`;
    
    setSyncStatus('syncing');
    try {
      const timestamp = Date.now();
      const payload = { 
        attendance, 
        students, 
        violations, 
        updatedBy: DEVICE_ID, 
        timestamp: timestamp 
      };
      const res = await fetch(url, { 
        method: 'PUT', 
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        lastUpdateAtRef.current = timestamp;
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncStatus('connected');
        setHasUnsavedChanges(false);
        if (force) alert("클라우드 연동이 완료되었습니다.");
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
  }, [syncKey, isSetup, attendance, students, violations]);

  useEffect(() => {
    if (!syncKey) return;
    try {
      const savedAttr = localStorage.getItem(`${STORAGE_KEY_PREFIX}attr_${syncKey}`);
      const savedStds = localStorage.getItem(`${STORAGE_KEY_PREFIX}std_${syncKey}`);
      const savedVios = localStorage.getItem(`${STORAGE_KEY_PREFIX}vio_${syncKey}`);
      
      if (savedAttr) setAttendance(JSON.parse(savedAttr));
      if (savedStds) setStudents(JSON.parse(savedStds));
      else setStudents(generateInitialStudents());
      if (savedVios) setViolations(JSON.parse(savedVios));
    } catch (e) {
      setStudents(generateInitialStudents());
    }
    fetchFromCloud();
  }, [syncKey]);

  useEffect(() => {
    if (!syncKey || !isSetup) return;
    const interval = setInterval(() => fetchFromCloud(false), 5000); // 5초 간격으로 완화
    return () => clearInterval(interval);
  }, [syncKey, isSetup, fetchFromCloud]);

  useEffect(() => {
    if (!syncKey || !isSetup) return;
    
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}attr_${syncKey}`, JSON.stringify(attendance));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}std_${syncKey}`, JSON.stringify(students));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}vio_${syncKey}`, JSON.stringify(violations));
    } catch (e) {}

    if (isUpdatingFromRemote.current) {
      isUpdatingFromRemote.current = false;
      return;
    }

    setHasUnsavedChanges(true);
    
    // 10초 후 자동 백업 연동 (주기적)
    const timer = setTimeout(() => { 
      pushToCloud(false); 
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [attendance, students, violations, syncKey, isSetup, pushToCloud]);

  const stats = useMemo(() => {
    try {
      const currentDayRecords = attendance[selectedDate] || {};
      const records = Object.values(currentDayRecords);
      const late = records.filter(r => r.type === 'late').length;
      const absent = records.filter(r => r.type === 'absent').length;
      return { late, absent, present: students.length - (late + absent), total: students.length };
    } catch (e) {
      return { late: 0, absent: 0, present: students.length, total: students.length };
    }
  }, [attendance, selectedDate, students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const nameMatch = s.name ? s.name.includes(searchQuery) : false;
      const numMatch = s.studentNumber ? s.studentNumber.includes(searchQuery) : false;
      const matchesSearch = nameMatch || numMatch;
      if (searchQuery) return matchesSearch;
      return (currentYear === null || s.year === currentYear) && (currentClass === null || s.classGroup === currentClass);
    });
  }, [searchQuery, currentYear, currentClass, students]);

  const updateStatus = (status: AttendanceStatus | null, studentId: string, options?: Partial<AttendanceEntry>) => {
    setAttendance(prev => {
      const newDayRecords = { ...(prev[selectedDate] || {}) };
      if (status === null) delete newDayRecords[studentId];
      else newDayRecords[studentId] = { ...(newDayRecords[studentId] || {}), type: status, ...options } as AttendanceEntry;
      return { ...prev, [selectedDate]: newDayRecords };
    });
  };

  const handleStart = (key: string) => {
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey) return;
    try {
      setSyncKey(cleanKey);
      setIsSetup(true);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_key', cleanKey);
      const newUrl = window.location.origin + window.location.pathname + '?key=' + cleanKey;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } catch (e) {}
  };

  const gradeThemes = {
    1: { hover: 'hover:border-red-500/50 hover:shadow-red-500/10', bg: 'bg-red-50', active: 'group-hover:bg-red-500', text: 'group-hover:text-red-600' },
    2: { hover: 'hover:border-green-500/50 hover:shadow-green-500/10', bg: 'bg-green-50', active: 'group-hover:bg-green-500', text: 'group-hover:text-green-600' },
    3: { hover: 'hover:border-blue-500/50 hover:shadow-blue-500/10', bg: 'bg-blue-50', active: 'group-hover:bg-blue-500', text: 'group-hover:text-blue-600' }
  };

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="bg-pink-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-pink-500/20 rotate-3">
            <UserCheck size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">석포여자중학교<br/>지각관리시스템</h1>
            <p className="text-slate-400 mt-3 font-medium text-sm">기기 간 실시간 동기화를 시작합니다.</p>
          </div>
          <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">학교 동기화 키 설정</label>
              <input 
                type="text" 
                placeholder="예: seokpo-girls"
                className="w-full bg-slate-800/50 border-none rounded-2xl px-6 py-5 text-xl font-black text-pink-500 placeholder:text-slate-600 focus:ring-4 focus:ring-pink-500/20 transition-all text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleStart(e.currentTarget.value)}
              />
            </div>
            <button 
              onClick={() => { const input = document.querySelector('input') as HTMLInputElement; if (input && input.value) handleStart(input.value); }}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group"
            >
              시스템 시작 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => {setCurrentYear(null); setCurrentClass(null); setActiveTab('list');}}>
                <div className="bg-slate-950 p-2.5 rounded-2xl text-white shadow-xl group-hover:bg-pink-600 transition-colors">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">석포여자중학교 지각관리시스템</h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${syncStatus === 'error' ? 'bg-orange-50 border-orange-200' : 'bg-slate-100 border-slate-200'}`}>
                      {syncStatus === 'syncing' ? <RefreshCw size={10} className="text-pink-500 animate-spin" /> : syncStatus === 'error' ? <WifiOff size={10} className="text-orange-500" /> : <Wifi size={10} className="text-green-500" />}
                      <span className="text-[8px] font-black text-slate-500 uppercase">{syncStatus === 'syncing' ? '연동중' : syncStatus === 'error' ? '대기' : lastSyncTime || '연동됨'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => pushToCloud(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all shadow-sm ${hasUnsavedChanges ? 'bg-pink-600 text-white animate-pulse-soft' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'}`}
                >
                  <Save size={14} /> <span className="hidden sm:inline">지금 바로 연동</span>
                </button>
                <button onClick={() => setIsLoginModalOpen(true)} className="bg-slate-950 text-white p-3 rounded-2xl hover:bg-slate-800 transition-all shadow-sm"><Lock size={16} /></button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex items-center bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm w-full md:w-auto">
                <Calendar size={18} className="text-pink-500 mr-2 shrink-0" />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-black focus:outline-none text-slate-700 w-full" />
              </div>
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="학생 검색..." className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex gap-8 whitespace-nowrap pt-2">
            {[{ id: 'list', label: '학생 현황', icon: LayoutGrid }, { id: 'stats', label: '데이터 분석', icon: TrendingUp }].map((tab) => (
              <button key={tab.id} onClick={() => {setActiveTab(tab.id as any); setIsAdminOpen(false);}} className={`pb-4 text-[13px] font-black transition-all flex items-center gap-2.5 border-b-4 ${activeTab === tab.id && !isAdminOpen ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {!isAdminOpen && (
        <div className="bg-slate-950 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-4 whitespace-nowrap">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Today Status</span>
              <div className="flex gap-2">
                <span className="bg-white/10 px-3 py-1 rounded-full text-[11px] font-black">출석 {stats.present}</span>
                <span className="bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-[11px] font-black">지각 {stats.late}</span>
                <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-[11px] font-black">결석 {stats.absent}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {hasUnsavedChanges && <span className="text-[10px] font-black text-pink-400 animate-pulse hidden sm:inline">저장되지 않은 변경사항이 있습니다.</span>}
              <button onClick={() => { try { navigator.clipboard.writeText(window.location.href); alert("동기화 링크 복사됨!"); } catch(e) {} }} className="flex items-center gap-2 text-[11px] font-black text-slate-400 hover:text-white transition-colors"><Smartphone size={14} /> 기기연동</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 w-full flex flex-col">
        {isAdminOpen ? (
          <div className="max-w-4xl mx-auto w-full"><AdminPanel students={students} setStudents={setStudents} violations={violations} setViolations={setViolations} attendance={attendance} selectedDate={selectedDate} syncKey={syncKey} onClose={() => setIsAdminOpen(false)} /></div>
        ) : activeTab === 'list' ? (
          <div className="animate-in fade-in duration-500 space-y-4 md:space-y-8 flex-1 flex flex-col">
            {!searchQuery && currentYear === null && (
              <div className="flex-1 flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-6 min-h-[400px]">
                {[1, 2, 3].map(year => {
                  const theme = gradeThemes[year as keyof typeof gradeThemes];
                  return (
                    <button key={year} onClick={() => setCurrentYear(year)} className={`group relative flex-1 flex flex-row md:flex-col items-center justify-center gap-4 md:gap-6 bg-white border border-slate-200 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] transition-all hover:shadow-2xl ${theme.hover} overflow-hidden shadow-sm`}>
                      <div className={`absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 ${theme.bg} rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700`}></div>
                      <div className={`relative bg-slate-50 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-slate-300 ${theme.active} group-hover:text-white transition-all duration-500`}><GraduationCap className="w-10 h-10 md:w-16 md:h-16" /></div>
                      <div className="relative text-left md:text-center"><h3 className={`text-2xl md:text-3xl font-black text-slate-900 ${theme.text} transition-colors`}>{year}학년</h3><p className="text-xs md:text-sm font-bold text-slate-400 mt-1 md:mt-2">반 선택</p></div>
                    </button>
                  );
                })}
              </div>
            )}
            {!searchQuery && currentYear !== null && currentClass === null && (
              <div className="space-y-6 flex-1">
                <button onClick={() => setCurrentYear(null)} className="flex items-center gap-2 text-slate-400 font-black hover:text-pink-600 transition-colors text-sm"><ChevronLeft size={20} /> 학년 선택으로</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(cls => (
                    <button key={cls} onClick={() => setCurrentClass(cls)} className="bg-white border border-slate-200 p-8 rounded-3xl hover:border-pink-500 hover:shadow-xl transition-all flex flex-col items-center gap-4 group shadow-sm">
                      <div className="bg-slate-50 p-4 rounded-2xl text-slate-400 group-hover:bg-pink-50 group-hover:text-pink-500 transition-colors"><Users size={32} /></div>
                      <h3 className="text-xl font-black text-slate-900">{cls}반</h3>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(searchQuery || (currentYear !== null && currentClass !== null)) && (
              <div className="space-y-6 flex-1">
                {!searchQuery && <button onClick={() => setCurrentClass(null)} className="flex items-center gap-2 text-slate-400 font-black hover:text-pink-600 transition-colors text-sm"><ChevronLeft size={20} /> 반 선택으로</button>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredStudents.map(student => (
                    <StudentCard key={student.id} student={student} entry={attendance[selectedDate]?.[student.id]} violations={violations} onStatusChange={(status, options) => updateStatus(status, student.id, options)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <StatsDashboard attendance={attendance} students={students} />
        )}
      </main>

      <footer className="py-8 px-4 text-center border-t border-slate-100 bg-white">
         <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"><span>석포여자중학교 지각관리시스템 v4.3</span><span className="w-1 h-1 rounded-full bg-slate-300"></span><span className="flex items-center gap-1">김용섭 제작 <Heart size={10} className="text-pink-500 fill-pink-500" /></span></div>
      </footer>

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-pink-600"></div>
            <div className="flex flex-col items-center text-center gap-6 mb-10"><div className="bg-slate-100 p-6 rounded-[2rem] text-slate-900 shadow-inner"><Lock size={40} /></div><h3 className="text-2xl font-black text-slate-900">시스템 관리자</h3></div>
            <form onSubmit={(e) => { e.preventDefault(); if (password === '1111') { setIsAdminOpen(true); setIsLoginModalOpen(false); setPassword(''); } else { alert('비밀번호가 틀렸습니다.'); setPassword(''); } }} className="space-y-6">
              <input autoFocus type="password" inputMode="numeric" maxLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PIN번호" className="w-full bg-slate-50 border-none rounded-3xl px-4 py-6 text-4xl font-black tracking-[0.8em] text-center text-pink-600 focus:ring-4 focus:ring-pink-500/10 transition-all" />
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsLoginModalOpen(false)} className="flex-1 py-5 text-sm font-black text-slate-400">닫기</button>
                <button type="submit" className="flex-1 bg-slate-950 text-white py-5 rounded-[1.5rem] font-black hover:bg-pink-600 transition-all">인증</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
