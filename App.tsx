
import React, { useState, useEffect, useMemo } from 'react';
import { generateInitialStudents, DEFAULT_VIOLATIONS } from './constants';
import { AttendanceState, AttendanceStatus, AttendanceEntry, Student, ViolationOption } from './types';
import StudentCard from './components/StudentCard';
import StatsDashboard from './components/StatsDashboard';
import AdminPanel from './components/AdminPanel';
import { Search, Calendar, ChevronRight, TrendingUp, Sparkles, UserCheck, LayoutGrid, Users, GraduationCap, ChevronLeft, ShieldCheck, Lock, Unlock, X, Cloud, Share2, QrCode, ArrowRight, Info, CheckCircle2, AlertCircle, Check, Heart } from 'lucide-react';

const App: React.FC = () => {
  const STORAGE_KEY_PREFIX = 'sg_pro_';
  
  const getUrlKey = () => new URLSearchParams(window.location.search).get('key');

  const [syncKey, setSyncKey] = useState<string>(getUrlKey() || localStorage.getItem(STORAGE_KEY_PREFIX + 'last_key') || '');
  const [isSetup, setIsSetup] = useState<boolean>(!!syncKey);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentClass, setCurrentClass] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [violations, setViolations] = useState<ViolationOption[]>(DEFAULT_VIOLATIONS);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const urlKey = getUrlKey();
    if (urlKey) {
      setSyncKey(urlKey);
      setIsSetup(true);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_key', urlKey);
    }
  }, []);

  useEffect(() => {
    if (!syncKey) return;

    const loadData = () => {
      const savedAttendance = localStorage.getItem(`${STORAGE_KEY_PREFIX}attr_${syncKey}`);
      const savedStudents = localStorage.getItem(`${STORAGE_KEY_PREFIX}std_${syncKey}`);
      const savedViolations = localStorage.getItem(`${STORAGE_KEY_PREFIX}vio_${syncKey}`);

      if (savedAttendance) setAttendance(JSON.parse(savedAttendance));
      if (savedStudents) setStudents(JSON.parse(savedStudents));
      else setStudents(generateInitialStudents());
      if (savedViolations) setViolations(JSON.parse(savedViolations));
    };

    loadData();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_KEY_PREFIX)) loadData();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [syncKey]);

  useEffect(() => {
    if (syncKey && isSetup) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}attr_${syncKey}`, JSON.stringify(attendance));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}std_${syncKey}`, JSON.stringify(students));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}vio_${syncKey}`, JSON.stringify(violations));
    }
  }, [attendance, students, violations, syncKey, isSetup]);

  const stats = useMemo(() => {
    const currentDayRecords = attendance[selectedDate] || {};
    const records = Object.values(currentDayRecords);
    const late = records.filter(r => r.type === 'late').length;
    const absent = records.filter(r => r.type === 'absent').length;
    return {
      late, absent,
      present: students.length - (late + absent),
      total: students.length
    };
  }, [attendance, selectedDate, students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.includes(searchQuery) || s.studentNumber.includes(searchQuery);
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
    setSyncKey(key);
    setIsSetup(true);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'last_key', key);
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?key=' + key;
    window.history.pushState({ path: newUrl }, '', newUrl);
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
            <p className="text-slate-400 mt-3 font-medium">스마트 학생 지도 및 동기화 시스템</p>
          </div>
          <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">학교 동기화 키 생성</label>
              <input 
                type="text" 
                placeholder="예: seokpo-girls"
                className="w-full bg-slate-800/50 border-none rounded-2xl px-6 py-5 text-xl font-black text-pink-500 placeholder:text-slate-600 focus:ring-4 focus:ring-pink-500/20 transition-all text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleStart(e.currentTarget.value)}
              />
            </div>
            <button 
              onClick={() => {
                const input = document.querySelector('input') as HTMLInputElement;
                if (input.value) handleStart(input.value);
              }}
              className="w-full bg-white text-slate-950 py-5 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group"
            >
              시작하기 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Created by 김용섭</p>
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
                  <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">석포여중 지각관리시스템</h1>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sync Active: {syncKey}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-slate-950 text-white p-3 md:px-4 md:py-2.5 rounded-2xl text-xs font-black shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Lock size={16} /> <span className="hidden md:inline">관리자</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex items-center bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm w-full md:w-auto">
                <Calendar size={18} className="text-pink-500 mr-2 shrink-0" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-black focus:outline-none text-slate-700 w-full"
                />
              </div>
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="학생 통합 검색..."
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 overflow-x-auto scrollbar-hide">
          <nav className="flex gap-8 whitespace-nowrap pt-2">
            {[
              { id: 'list', label: '출석 현황', icon: LayoutGrid },
              { id: 'stats', label: '데이터 분석', icon: TrendingUp }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => {setActiveTab(tab.id as any); setIsAdminOpen(false);}}
                className={`pb-4 text-[13px] font-black transition-all flex items-center gap-2.5 border-b-4 ${activeTab === tab.id && !isAdminOpen ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {!isAdminOpen && (
        <div className="bg-slate-950 text-white">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-4 whitespace-nowrap">
              <span className="text-[11px] font-black text-slate-500 uppercase">Today Summary</span>
              <div className="flex gap-2">
                <span className="bg-white/10 px-3 py-1 rounded-full text-[11px] font-black">출석 {stats.present}</span>
                <span className="bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-[11px] font-black">지각 {stats.late}</span>
                <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-[11px] font-black">결석 {stats.absent}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
               <button 
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    alert("동기화 링크가 복사되었습니다! 아이폰으로 보내세요.");
                  }}
                  className="flex items-center gap-2 text-[11px] font-black text-pink-400 hover:text-pink-300 transition-colors"
                >
                  <Share2 size={14} /> 모바일 링크 복사
                </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 w-full flex flex-col">
        {isAdminOpen ? (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500 w-full">
            <AdminPanel 
              students={students} 
              setStudents={setStudents}
              violations={violations}
              setViolations={setViolations}
              attendance={attendance}
              selectedDate={selectedDate}
              syncKey={syncKey}
              onClose={() => setIsAdminOpen(false)}
            />
          </div>
        ) : activeTab === 'list' ? (
          <div className="animate-in fade-in duration-500 space-y-4 md:space-y-8 flex-1 flex flex-col">
            {(searchQuery || (currentYear !== null && currentClass !== null)) && (
              <div className="bg-white/50 border border-slate-200 rounded-[2rem] p-4 md:p-6 shadow-sm overflow-hidden relative">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <Info size={18} className="text-slate-400" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">성찰문 지도 가이드</span>
                  </div>
                  <div className="h-px md:h-4 md:w-px bg-slate-200"></div>
                  <div className="flex flex-wrap items-center gap-4 md:gap-8">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white border-2 border-slate-100 flex items-center justify-center text-slate-200">
                        <Check size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-500">미부여</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-400 border-2 border-orange-400 flex items-center justify-center text-white animate-pulse-soft">
                        <AlertCircle size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">부여됨 (지도 중)</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">학생에게 배부한 상태</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-green-500 border-2 border-green-500 flex items-center justify-center text-white">
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">확인 완료</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">회수 및 지도 종료</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!searchQuery && currentYear === null && (
              <div className="flex-1 flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-6 min-h-[400px]">
                {[1, 2, 3].map(year => {
                  const theme = gradeThemes[year as keyof typeof gradeThemes];
                  return (
                    <button 
                      key={year}
                      onClick={() => setCurrentYear(year)}
                      className={`group relative flex-1 flex flex-row md:flex-col items-center justify-center gap-4 md:gap-6 bg-white border border-slate-200 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] transition-all hover:shadow-2xl ${theme.hover} overflow-hidden`}
                    >
                      <div className={`absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 ${theme.bg} rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700`}></div>
                      <div className={`relative bg-slate-50 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-slate-300 ${theme.active} group-hover:text-white transition-all duration-500`}>
                        <GraduationCap className="w-10 h-10 md:w-16 md:h-16" />
                      </div>
                      <div className="relative text-left md:text-center">
                        <h3 className={`text-2xl md:text-3xl font-black text-slate-900 ${theme.text} transition-colors`}>{year}학년</h3>
                        <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 md:mt-2">명단 확인하기</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!searchQuery && currentYear !== null && currentClass === null && (
              <div className="space-y-6 flex-1">
                <button onClick={() => setCurrentYear(null)} className="flex items-center gap-2 text-slate-400 font-black hover:text-pink-600 transition-colors text-sm">
                  <ChevronLeft size={20} /> 학년 선택
                </button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(cls => (
                    <button 
                      key={cls}
                      onClick={() => setCurrentClass(cls)}
                      className="bg-white border border-slate-200 p-8 rounded-3xl hover:border-pink-500 hover:shadow-xl transition-all flex flex-col items-center gap-4"
                    >
                      <div className="bg-slate-50 p-4 rounded-2xl text-slate-400">
                        <Users size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{cls}반</h3>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(searchQuery || (currentYear !== null && currentClass !== null)) && (
              <div className="space-y-6 flex-1">
                {!searchQuery && (
                  <button onClick={() => setCurrentClass(null)} className="flex items-center gap-2 text-slate-400 font-black hover:text-pink-600 transition-colors text-sm">
                    <ChevronLeft size={20} /> 반 선택
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredStudents.map(student => (
                    <StudentCard 
                      key={student.id} 
                      student={student} 
                      entry={attendance[selectedDate]?.[student.id]}
                      violations={violations}
                      onStatusChange={(status, options) => updateStatus(status, student.id, options)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <StatsDashboard attendance={attendance} students={students} />
        )}
      </main>

      <footer className="py-8 px-4 text-center">
         <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <span>석포여자중학교 지각관리시스템</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="flex items-center gap-1">Created with <Heart size={10} className="text-pink-500 fill-pink-500" /> by 김용섭</span>
         </div>
      </footer>

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-pink-600"></div>
            <div className="flex flex-col items-center text-center gap-6 mb-10">
              <div className="bg-slate-100 p-6 rounded-[2rem] text-slate-900 shadow-inner">
                <Lock size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Admin Login</h3>
                <p className="text-sm font-bold text-slate-400 mt-2">비밀번호 4자리를 입력하세요.</p>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (password === '1111') { setIsAdminOpen(true); setIsLoginModalOpen(false); setPassword(''); }
              else { alert('비밀번호가 틀렸습니다.'); setPassword(''); }
            }} className="space-y-6">
              <input 
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-50 border-none rounded-3xl px-4 py-6 text-4xl font-black tracking-[0.8em] text-center text-pink-600 focus:ring-4 focus:ring-pink-500/10 transition-all"
              />
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="flex-1 py-5 text-sm font-black text-slate-400 hover:text-slate-600"
                >
                  닫기
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-slate-950 text-white py-5 rounded-[1.5rem] font-black hover:bg-pink-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  인증
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
