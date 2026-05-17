import React, { useMemo } from 'react';
import { User, ChecklistSubmission } from '../../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { addDays } from 'date-fns';
import { SparklesIcon } from '../icons/SparklesIcon';
import { useWorkshop } from '../../contexts/AppContexts';

const DriverScorecardReport: React.FC = () => {
    const { users = [], checklistSubmissions = [] } = useWorkshop();

    const driverData = useMemo(() => {
        const thirtyDaysAgo = addDays(new Date(), -30);
        const now = new Date();

        const staffUsers = (users || []).filter(u => u.role === 'Staff');
        if (staffUsers.length === 0) return [];

        const data = staffUsers.map(driver => {
            const driverSubmissions = (checklistSubmissions || []).filter(cs => cs.userId === driver.email);
            
            const submissionDates = new Set(driverSubmissions.map(cs => new Date(cs.date).toDateString()));
            let daysWithSubmission = 0;
            for (let i = 0; i < 30; i++) {
                const date = addDays(now, -i).toDateString();
                if (submissionDates.has(date)) {
                    daysWithSubmission++;
                }
            }
            const consistencyScore = Math.round((daysWithSubmission / 30) * 100);

            if (driverSubmissions.length === 0) {
                 return { name: driver.name, email: driver.email, consistency: 0, issuesPerChecklist: 0, overallScore: 0, chartData: [{ subject: 'Consistency', A: 0, fullMark: 100 }, { subject: 'Diligence', A: 0, fullMark: 100 }]};
            }

            const totalIssues = driverSubmissions.reduce((sum, cs) => sum + (cs.results || []).filter(r => r.status !== 'Pass').length, 0);
            const issuesPerChecklist = totalIssues / driverSubmissions.length;
            const diligenceScore = Math.max(0, Math.round((1 - (issuesPerChecklist / 4)) * 100));

            return { name: driver.name, email: driver.email, consistency: consistencyScore, issuesPerChecklist, overallScore: consistencyScore + diligenceScore, chartData: [{ subject: 'Consistency', A: consistencyScore, fullMark: 100 }, { subject: 'Diligence', A: diligenceScore, fullMark: 100 }]};
        });
        
        if (data.length === 0) return [];

        const topScorer = data.reduce((top, current) => current.overallScore > top.overallScore ? current : top);
        return data.map(d => ({ ...d, isTopPerformer: d.email === topScorer.email }));

    }, [users, checklistSubmissions]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Driver Scorecard Report</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4">Driver Performance Overview</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="p-3 text-gray-400 w-1/4">Driver</th>
                                <th className="p-3 text-gray-400 text-center w-1/4">Checklist Consistency (Last 30d)</th>
                                <th className="p-3 text-gray-400 text-center w-1/4">Avg. Issues Reported / Checklist</th>
                                <th className="p-3 text-gray-400 text-center w-1/4">Performance Profile</th>
                            </tr>
                        </thead>
                        <tbody>
                            {driverData.map(driver => (
                                <tr key={driver.email} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="p-3 font-semibold text-white">
                                        <div className="flex items-center">
                                            <span>{driver.name}</span>
                                            {driver.isTopPerformer && (
                                                <span title="Top Performer" className="ml-2 flex items-center text-xs font-bold px-2 py-1 rounded-full bg-yellow-900/50 text-yellow-300">
                                                    <SparklesIcon className="h-4 w-4 mr-1"/> Top Performer
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono text-lg">{driver.consistency}%</td>
                                    <td className="p-3 text-center font-mono text-lg">{driver.issuesPerChecklist.toFixed(2)}</td>
                                    <td className="p-3 h-32">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={driver.chartData}>
                                                <PolarGrid stroke="#4b5563" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <Radar name={driver.name} dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.6} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {driverData.length === 0 && <p className="text-center text-gray-500 py-10">No driver data available.</p>}
                </div>
            </div>
        </div>
    );
};

export default DriverScorecardReport;