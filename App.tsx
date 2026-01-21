// App.tsx 상단에 추가
const KV_KEY = 'seokpo_shared_data';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { Search, Calendar, TrendingUp, UserCheck, LayoutGrid, GraduationCap, ChevronLeft, Lock, Unlock, ArrowRight, Heart, Wifi, WifiOff, RefreshCw, Smartphone, Save, ShieldCheck, Settings, Loader2 } from 'lucide-react';

// 1. 기기 ID 고정 (절대 새로고침으로 변하지 않음)
const getPersistentDeviceId = () => {
  let id = localStorage.getItem('seokpo_device_id_v5');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('seokpo_device_id_v5', id);
  }
  return id;
};

const DEVICE_ID = getPersistentDeviceId();
const BUCKET_ID = "AnV9v8pB3vB6g7r9q8zX1";
const BASE_KEY = "seokpo_v6_final"; 

const App: React.FC = () => {
  const STORAGE_KEY_PREFIX = 'sg_pro_v6_';
  
  const [authCode, setAuthCode] = useState<string>(() => localStorage.getItem(STORAGE_KEY_PREFIX + 'auth') || '');
  const [isSetup, setIsSetup] = useState<boolean>(authCode === '1111');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'admin'>('list');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  // --- 동기화 제어 시스템 ---
  const lastUpdateAtRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const isPushingRef = useRef<boolean>(false);
  const [isAppReady, setIsAppReady] = useState<boolean>(false); // 초기 동기화 완료 여부
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'error' | 'idle'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isDataDirty, setIsDataDirty] = useState(false); // 오직 사용자 액션시에만 true

  const syncKey = useMemo(() => isSetup ? `${BASE_KEY}_${authCode}` : '', [isSetup, authCode]);

  // 클라우드 데이터 가져오기 (Pull)
  const fetchFromCloud = useCallback(async (isInitial = false) => {
    if (!syncKey || isPullingRef.current || isPushingRef.current) return;
    
    isPullingRef.current = true;
    setSyncStatus('syncing');
    
    try {
      const res = await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text !== "null") {
          const data = JSON.parse(text);
          // 서버 데이터가 더 최신이거나 기기가 다른 경우 동기화
          if (data && data.timestamp > lastUpdateAtRef.current) {
  setAttendance(data.attendance || {});
  setStudents(data.students || []);
  setViolations(data.violations || DEFAULT_VIOLATIONS);
  lastUpdateAtRef.current = data.timestamp;
  setLastSyncTime(new Date().toLocaleTimeString());
  setIsDataDirty(false);
}
        }
      }
      setSyncStatus('connected');
      if (isInitial) setIsAppReady(true);
    } catch (e) {
      setSyncStatus('error');
      if (isInitial) setIsAppReady(true); // 에러나도 일단 앱은 시작
    } finally {
      isPullingRef.current = false;
    }
  }, [syncKey]);

  // 클라우드 데이터 저장 (Push)
  const pushToCloud = useCallback(async (force = false) => {
    // 앱 초기화 전이거나, 현재 작업 중이면 중단
    if (!syncKey || !isAppReady || isPullingRef.current || isPushingRef.current) return;
    if (!isDataDirty && !force) return;

    isPushingRef.current = true;
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
      
      const res = await fetch(`https://kvdb.io/${BUCKET_ID}/${syncKey}`, { 
        method: 'PUT', 
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        lastUpdateAtRef.current = timestamp;
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncStatus('connected');
        setIsDataDirty(false);
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    } finally {
      isPushingRef.current = false;
    }
  }, [syncKey, isAppReady, attendance, students, violations, isDataDirty]);

  // 초기 로그인 완료 시 부팅 로직
  useEffect(() => {
    if (!isSetup) return;
    
    // 1. 일단 로컬 데이터 로드
    const savedAttr = localStorage.getItem(`${STORAGE_KEY_PREFIX}attr`);
    const savedStds = localStorage.getItem(`${STORAGE_KEY_PREFIX}std`);
    if (savedAttr) setAttendance(JSON.parse(savedAttr));
    if (savedStds) {
      const parsed = JSON.parse(savedStds);
      if (parsed.length > 0) setStudents(parsed);
      else setStudents(generateInitialStudents());
    } else {
      setStudents(generateInitialStudents());
    }

    // 2. 서버 데이터 필수 확인 (Pull이 끝나야 Push 허용됨)
    fetchFromCloud(true);
  }, [isSetup]);
  


  // 주기적 서버 체크 (6초)
  useEffect(() => {
    if (!isSetup || !isAppReady) return;
    const interval = setInterval(() => fetchFromCloud(false), 6000);
    return () => clearInterval(interval);
  }, [isSetup, isAppReady, fetchFromCloud]);

  // 데이터 변경 시 로컬 저장 및 예약 전송
  useEffect(() => {
    if (!isSetup || !isAppReady) return;
    
    localStorage.setItem(`${STORAGE_KEY_PREFIX}attr`, JSON.stringify(attendance));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}std`, JSON.stringify(students));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}vio`, JSON.stringify(violations));

    if (isDataDirty) {
      const timer = setTimeout(() => pushToCloud(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [attendance, students, violations, isSetup, isAppReady, pushToCloud, isDataDirty]);

  const stats = useMemo(() => {
    const currentDayRecords = attendance[selectedDate] || {};
    const records = Object.values(currentDayRecords);
    const late = records.filter(r => r.type === 'late').length;
    const absent = records.filter(r => r.type === 'absent').length;
    return { late, absent, present: students.length - (late + absent), total: students.length };
  }, [attendance, selectedDate, students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.includes(searchQuery) || s.studentNumber.includes(searchQuery);
      if (searchQuery) return matchesSearch;
      return (currentYear === null || s.year === currentYear) && (currentClass === null || s.classGroup === currentClass);
    });
  }, [searchQuery, currentYear, currentClass, students]);

  const updateStatus = (status: AttendanceStatus | null, studentId: string, options?: Partial<AttendanceEntry>) => {
    setIsDataDirty(true); // 사용자 조작 발생 알림
    setAttendance(prev => {
      const newDayRecords = { ...(prev[selectedDate] || {}) };
      if (status === null) delete newDayRecords[studentId];
      else newDayRecords[studentId] = { ...(newDayRecords[studentId] || {}), type: status, ...options } as AttendanceEntry;
      return { ...prev, [selectedDate]: newDayRecords };
    });
  };

  const handleLogin = (val: string) => {
    if (val === '1111') {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'auth', val);
      setAuthCode(val);
      setIsSetup(true);
    } else {
      alert('비밀번호가 틀립니다. (1111)');
    }
  };

  const handleLogout = () => {
    if (confirm('시스템에서 로그아웃 하시겠습니까? 데이터는 클라우드에 보존됩니다.')) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth');
      window.location.reload();
    }
  };

  // 초기 접속 잠금 화면
  if (isSetup && !isAppReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={48} className="text-pink-500 animate-spin mb-6" />
        <h2 className="text-2xl font-black text-white">클라우드 데이터 연동 중...</h2>
        <p className="text-slate-500 mt-2 font-bold">다른 기기의 최신 정보를 가져오는 중입니다. 잠시만 기다려주세요.</p>
      </div>
    );
  }

  // 로그인 화면
  if (!isSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="bg-pink-600/20 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl backdrop-blur-xl border border-pink-500/30 rotate-3">
            <Lock size={48} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">석포여자중학교<br/><span className="text-pink-500">지각관리시스템</span></h1>
            <p className="text-slate-500 mt-3 font-medium text-sm">암호 "1111"을 입력하여 모든 기기 데이터를 통합하세요.</p>
          </div>
          <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 space-y-8 shadow-3xl">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">통합 접속 암호</label>
              <input 
                autoFocus
                type="password" 
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                className="w-full bg-slate-800/50 border-none rounded-3xl px-6 py-6 text-4xl font-black text-pink-500 placeholder:text-slate-700 focus:ring-4 focus:ring-pink-500/20 transition-all text-center tracking-[1em]"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(e.currentTarget.value)}
              />
            </div>
            <button 
              onClick={() => { const input = document.querySelector('input') as HTMLInputElement; handleLogin(input.value); }}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group"
            >
              시스템 접속 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const gradeThemes = {
    1: { hover: 'hover:border-red-500/50', bg: 'bg-red-50', active: 'group-hover:bg-red-500', text: 'group-hover:text-red-600' },
    2: { hover: 'hover:border-green-500/50', bg: 'bg-green-50', active: 'group-hover:bg-green-500', text: 'group-hover:text-green-600' },
    3: { hover: 'hover:border-blue-500/50', bg: 'bg-blue-50', active: 'group-hover:bg-blue-500', text: 'group-hover:text-blue-600' }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 cursor-pointer group" onClick={() => {setCurrentYear(null); setCurrentClass(null); setActiveTab('list');}}>
                <div className="bg-slate-950 p-3 rounded-2xl text-white shadow-xl group-hover:bg-pink-600 transition-all">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">석포여자중학교 지각관리</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${syncStatus === 'error' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                      {syncStatus === 'syncing' ? <RefreshCw size={10} className="text-pink-500 animate-spin" /> : syncStatus === 'error' ? <WifiOff size={10} className="text-orange-500" /> : <Wifi size={10} className="text-green-500" />}
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                        {syncStatus === 'syncing' ? '데이터 동기화 중...' : syncStatus === 'error' ? '연결 끊김' : lastSyncTime ? `${lastSyncTime} 통합 연동됨` : '클라우드 연결됨'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => pushToCloud(true)}
                  disabled={!isDataDirty && syncStatus !== 'error'}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs transition-all shadow-sm ${isDataDirty ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'bg-white border border-slate-200 text-slate-400 opacity-60'}`}
                >
                  <Save size={16} /> <span className="hidden sm:inline">{isDataDirty ? '지금 변경사항 저장' : '저장 완료'}</span>
                </button>
                <button onClick={handleLogout} className="bg-slate-950 text-white p-3.5 rounded-2xl hover:bg-slate-800 transition-all shadow-sm" title="로그아웃"><Unlock size={18} /></button>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex items-center bg-white rounded-2xl px-5 py-3.5 border border-slate-200 shadow-sm w-full md:w-auto">
                <Calendar size={18} className="text-pink-500 mr-3 shrink-0" />
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-black focus:outline-none text-slate-700 w-full" />
              </div>
              <div className="relative flex-1">
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="검색어를 입력하세요 (이름/학번)" className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-3.5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <nav className="flex gap-10 whitespace-nowrap pt-2">
            {[
              { id: 'list', label: '학생 현황', icon: LayoutGrid },
              { id: 'stats', label: '데이터 분석', icon: TrendingUp },
              { id: 'admin', label: '관리자 설정', icon: ShieldCheck }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-5 text-[14px] font-black transition-all flex items-center gap-2.5 border-b-[4px] ${activeTab === tab.id ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">오늘의 요약</span>
            <div className="flex gap-3">
              <span className="bg-white/10 px-4 py-1.5 rounded-full text-[11px] font-black">정상 {stats.present}</span>
              <span className="bg-yellow-400/20 text-yellow-400 px-4 py-1.5 rounded-full text-[11px] font-black">지각 {stats.late}</span>
              <span className="bg-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-[11px] font-black">결석 {stats.absent}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 tracking-tighter">
              <Smartphone size={14} /> ID: {DEVICE_ID}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 w-full">
        {activeTab === 'admin' ? (
          <div className="animate-in fade-in slide-in-from-bottom-5">
            <AdminPanel 
              students={students} 
              setStudents={(newStds) => { setIsDataDirty(true); setStudents(newStds); }} 
              violations={violations} 
              setViolations={(newVios) => { setIsDataDirty(true); setViolations(newVios); }} 
              attendance={attendance} 
              selectedDate={selectedDate} 
              syncKey={syncKey} 
              onClose={() => setActiveTab('list')} 
            />
          </div>
        ) : activeTab === 'list' ? (
          <div className="space-y-6 md:space-y-10">
            {!searchQuery && currentYear === null && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                {[1, 2, 3].map(year => {
                   const theme = gradeThemes[year as keyof typeof gradeThemes];
                   return (
                    <button key={year} onClick={() => setCurrentYear(year)} className={`group relative bg-white border border-slate-200 p-10 md:p-14 rounded-[3.5rem] transition-all hover:shadow-2xl ${theme.hover} overflow-hidden shadow-sm`}>
                      <div className={`relative bg-slate-50 p-10 rounded-[2.5rem] text-slate-300 ${theme.active} group-hover:text-white transition-all flex items-center justify-center mb-6`}>
                        <GraduationCap className="w-16 h-16" />
                      </div>
                      <h3 className={`text-3xl font-black text-slate-900 ${theme.text} transition-colors`}>{year}학년</h3>
                      <p className="text-slate-400 font-bold mt-2">학급 선택</p>
                    </button>
                   );
                })}
              </div>
            )}
            {!searchQuery && currentYear !== null && currentClass === null && (
              <div className="space-y-8 animate-in slide-in-from-right-5">
                <button onClick={() => setCurrentYear(null)} className="flex items-center gap-3 text-slate-500 font-black hover:text-pink-600 px-2"><ChevronLeft size={22} /> 학년 선택</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {[1, 2, 3, 4].map(cls => (
                    <button key={cls} onClick={() => setCurrentClass(cls)} className="bg-white border border-slate-200 p-10 rounded-[2.5rem] hover:border-pink-500 hover:shadow-2xl transition-all flex flex-col items-center gap-6 group">
                      <div className="bg-slate-50 p-6 rounded-[1.75rem] text-slate-400 group-hover:bg-pink-50 group-hover:text-pink-500 transition-colors"><Settings size={36} /></div>
                      <h3 className="text-2xl font-black text-slate-900">{cls}반</h3>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(searchQuery || (currentYear !== null && currentClass !== null)) && (
              <div className="space-y-8 animate-in slide-in-from-bottom-5">
                {!searchQuery && <button onClick={() => setCurrentClass(null)} className="flex items-center gap-3 text-slate-500 font-black hover:text-pink-600 px-2"><ChevronLeft size={22} /> 학급 선택</button>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredStudents.map(student => (
                    <StudentCard key={student.id} student={student} entry={attendance[selectedDate]?.[student.id]} violations={violations} onStatusChange={(status, options) => updateStatus(status, student.id, options)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in">
            <StatsDashboard attendance={attendance} students={students} />
          </div>
        )}
      </main>

      <footer className="py-10 text-center border-t border-slate-100 bg-white">
         <div className="flex items-center justify-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
           <span>석포여자중학교 지각관리 v6.0 (Perfect-Sync)</span>
           <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
           <span className="flex items-center gap-2">김용섭 제작 <Heart size={12} className="text-pink-500 fill-pink-500" /></span>
         </div>
      </footer>
    </div>
  );
}

export default App;
