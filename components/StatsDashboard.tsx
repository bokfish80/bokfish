
import React, { useMemo, useState } from 'react';
import { AttendanceState, Student, AttendanceEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, AlertCircle, Clock, TrendingUp, ShieldAlert, Filter, CalendarDays, BarChart3, FileText } from 'lucide-react';

interface StatsDashboardProps {
  attendance: AttendanceState;
  students: Student[];
}

type PeriodType = 'weekly' | 'monthly' | 'total';

const StatsDashboard: React.FC<StatsDashboardProps> = ({ attendance, students }) => {
  const [period, setPeriod] = useState<PeriodType>('total');
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');

  const allDates = useMemo(() => Object.keys(attendance).sort(), [attendance]);

  const filteredData = useMemo(() => {
    let datesToInclude = [...allDates];
    const now = new Date();
    
    if (period === 'weekly') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      datesToInclude = allDates.filter(d => new Date(d) >= sevenDaysAgo);
    } else if (period === 'monthly') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      datesToInclude = allDates.filter(d => new Date(d) >= thirtyDaysAgo);
    }

    let totalLate = 0;
    let totalAbsent = 0;
    let totalViolation = 0;
    let pendingReflectionCount = 0;
    
    const studentIssues: Record<string, { count: number, pendingRef: number }> = {};
    const dailyTrend: any[] = [];
    const breakdown: Record<string, { name: string, late: number, absent: number, violation: number }> = {};

    datesToInclude.forEach(date => {
      const dayRecords = attendance[date];
      let dayLate = 0, dayAbsent = 0, dayViolation = 0;

      // Cast entry as AttendanceEntry to fix type errors
      Object.entries(dayRecords).forEach(([studentId, entryVal]) => {
        const entry = entryVal as AttendanceEntry;
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        const matchesYear = filterYear === 'all' || student.year === filterYear;
        const matchesClass = filterClass === 'all' || student.classGroup === filterClass;

        if (matchesYear && matchesClass) {
          if (entry.type === 'late') { totalLate++; dayLate++; }
          else if (entry.type === 'absent') { totalAbsent++; dayAbsent++; }
          else if (entry.type === 'violation') { totalViolation++; dayViolation++; }
          
          if (!studentIssues[studentId]) studentIssues[studentId] = { count: 0, pendingRef: 0 };
          studentIssues[studentId].count += 1;

          // Track pending reflections
          if (entry.reflection1 === 'assigned') { pendingReflectionCount++; studentIssues[studentId].pendingRef++; }
          if (entry.reflection2 === 'assigned') { pendingReflectionCount++; studentIssues[studentId].pendingRef++; }
        }

        let groupKey = "";
        let groupName = "";
        
        if (filterYear === 'all') {
          groupKey = `Y${student.year}`;
          groupName = `${student.year}학년`;
        } else if (filterClass === 'all') {
          if (student.year === filterYear) {
            groupKey = `C${student.classGroup}`;
            groupName = `${student.classGroup}반`;
          }
        }

        if (groupKey) {
          if (!breakdown[groupKey]) breakdown[groupKey] = { name: groupName, late: 0, absent: 0, violation: 0 };
          if (entry.type === 'late') breakdown[groupKey].late++;
          else if (entry.type === 'absent') breakdown[groupKey].absent++;
          else if (entry.type === 'violation') breakdown[groupKey].violation++;
        }
      });

      if (dayLate + dayAbsent + dayViolation > 0 || period === 'total') {
        dailyTrend.push({
          name: date.split('-').slice(1).join('/'),
          late: dayLate,
          absent: dayAbsent,
          violation: dayViolation
        });
      }
    });

    const topAtRisk = Object.entries(studentIssues)
      .map(([id, stats]) => {
        const s = students.find(std => std.id === id);
        return { 
          name: s?.name || 'Unknown', 
          number: s?.studentNumber || '0000', 
          count: stats.count,
          pendingRef: stats.pendingRef
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalLate,
      totalAbsent,
      totalViolation,
      pendingReflectionCount,
      topAtRisk,
      dailyTrend: period === 'total' ? dailyTrend.slice(-10) : dailyTrend,
      breakdown: Object.values(breakdown).sort((a, b) => a.name.localeCompare(b.name)),
      totalTarget: students.filter(s => (filterYear === 'all' || s.year === filterYear) && (filterClass === 'all' || s.classGroup === filterClass)).length
    };
  }, [attendance, allDates, period, filterYear, filterClass, students]);

  if (allDates.length === 0) {
    return (
      <div className="py-32 text-center text-slate-400">
        <TrendingUp size={64} className="mx-auto mb-6 opacity-10" />
        <p className="text-xl font-medium">관리 데이터가 수집되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <Filter size={18} className="text-pink-500" />
          <span className="text-sm font-black text-slate-700">통계 필터</span>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['weekly', 'monthly', 'total'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : '전체'}
            </button>
          ))}
        </div>

        <select 
          value={filterYear}
          onChange={(e) => {setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value)); setFilterClass('all');}}
          className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-pink-500/20"
        >
          <option value="all">학년 전체</option>
          <option value="1">1학년</option>
          <option value="2">2학년</option>
          <option value="3">3학년</option>
        </select>

        <select 
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-pink-500/20"
        >
          <option value="all">반 전체</option>
          <option value="1">1반</option>
          <option value="2">2반</option>
          <option value="3">3반</option>
          <option value="4">4반</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-yellow-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-50 p-2 rounded-xl text-yellow-600">
              <Clock size={18} />
            </div>
            <p className="text-xs text-slate-500 font-black uppercase tracking-wider">누적 지각</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{filteredData.totalLate}<span className="text-sm font-bold ml-1 text-slate-400">건</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
              <ShieldAlert size={18} />
            </div>
            <p className="text-xs text-slate-500 font-black uppercase tracking-wider">누적 위반</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{filteredData.totalViolation}<span className="text-sm font-bold ml-1 text-slate-400">건</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-50 p-2 rounded-xl text-orange-600">
              <FileText size={18} />
            </div>
            <p className="text-xs text-slate-500 font-black uppercase tracking-wider">미회수 성찰문</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{filteredData.pendingReflectionCount}<span className="text-sm font-bold ml-1 text-slate-400">건</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-600">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
              <Users size={18} />
            </div>
            <p className="text-xs text-slate-500 font-black uppercase tracking-wider">분석 대상</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{filteredData.totalTarget}<span className="text-sm font-bold ml-1 text-slate-400">명</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-pink-500" />
              {filterYear === 'all' ? '학년별 비교' : filterClass === 'all' ? `${filterYear}학년 반별 비교` : '일별 추이'}
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filterClass === 'all' || filterYear === 'all' ? filteredData.breakdown : filteredData.dailyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px', fontSize: '11px', fontWeight: 700 }} />
                <Bar dataKey="late" name="지각" fill="#facc15" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="결석" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="violation" name="교칙위반" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <AlertCircle size={20} className="text-red-500" />
              생활 지도 집중 관리 대상
            </h3>
          </div>
          <div className="space-y-4">
            {filteredData.topAtRisk.length > 0 ? (
              filteredData.topAtRisk.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-xs font-black text-slate-400 border border-slate-200 shadow-sm">{idx + 1}</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-pink-500 tracking-tighter">{item.number}</span>
                      <span className="font-bold text-slate-800">{item.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 block">누적 {item.count}건</span>
                      {item.pendingRef > 0 && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">미회수 {item.pendingRef}건</span>
                      )}
                    </div>
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-500 transition-all duration-700 ease-out" 
                        style={{ width: `${Math.min((item.count / 10) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <CalendarDays size={48} className="mb-4 opacity-20" />
                <p className="text-center font-bold italic">기록된 생활 지도 이슈가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
