import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { IssueLog } from '../types';
import { TruckIcon, UserCircleIcon, PaperClipIcon, XIcon, TrashIcon } from './icons/Icons';

const priorityStyles = {
    High: { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-500/20' },
    Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-500/20' },
    Low: { bg: 'bg-gray-100', text: 'text-gray-800', ring: 'ring-gray-500/20' },
};

const statusStyles = {
    Open: { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-500/20' },
    'In Progress': { bg: 'bg-purple-100', text: 'text-purple-800', ring: 'ring-purple-500/20' },
    Resolved: { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-500/20' },
};


// Issue Detail Modal
interface IssueDetailModalProps {
    issue: IssueLog | null;
    onClose: () => void;
}

const IssueDetailModal: React.FC<IssueDetailModalProps> = ({ issue, onClose }) => {
    const { vehicles, users, updateIssueLog, deleteIssueLog } = useAppContext();
    const [newStatus, setNewStatus] = useState<IssueLog['status'] | ''>('');
    const [newComment, setNewComment] = useState('');

    const parsedComments = useMemo(() => {
        if (!issue?.comments) return [];
        // Split entries by the double newline that separates them
        return issue.comments.split('\n\n').map((entry, index) => {
            const lines = entry.split('\n');
            const headerLine = lines[0] || '';
            const body = lines.slice(1).join('\n');

            // Extract user and timestamp from "--- User (Timestamp) ---" format
            const headerMatch = headerLine.match(/--- (.*?) \((.*?)\) ---/);

            if (headerMatch) {
                return {
                    id: `${issue.id}-comment-${index}`,
                    user: headerMatch[1],
                    timestamp: headerMatch[2],
                    body,
                };
            }
            // Fallback for text that doesn't match the header format
            return { id: `${issue.id}-comment-${index}`, body: entry };
        });
    }, [issue?.comments, issue?.id]);

    if (!issue) return null;

    const vehicle = vehicles.find(v => v.id === issue.vehicleId);
    const reporter = users.find(u => u.id === issue.reportedById);

    const handleUpdate = () => {
        if (!newStatus && !newComment.trim()) return;

        const updatedData: Partial<IssueLog> = {};
        if (newStatus) {
            updatedData.status = newStatus;
        }
        if (newComment.trim()) {
            const user = "Admin"; // In a real app, this would be the current admin's name
            const timestamp = new Date().toLocaleString('en-GB');
            const newCommentEntry = `--- ${user} (${timestamp}) ---\n${newComment.trim()}`;
            // Prepend new comment for newest-first visibility
            updatedData.comments = issue.comments
                ? `${newCommentEntry}\n\n${issue.comments}`
                : newCommentEntry;
        }
        
        updateIssueLog(issue.id, updatedData);
        // Clear inputs for next update, but keep modal open for context
        setNewStatus('');
        setNewComment('');
    };
    
    const handleDelete = () => {
        if (window.confirm('Are you sure you want to permanently delete this issue log?')) {
            deleteIssueLog(issue.id);
            onClose();
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800 truncate" title={issue.issueTitle}>Issue: {issue.issueTitle}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Details Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div className="flex items-center space-x-2"><TruckIcon className="h-5 w-5 text-gray-400"/><span className="font-medium">Vehicle:</span><span>{vehicle?.name} ({vehicle?.plateNumber})</span></div>
                        <div className="flex items-center space-x-2"><UserCircleIcon className="h-5 w-5 text-gray-400"/><span className="font-medium">Reported By:</span><span>{reporter?.name}</span></div>
                        <div><span className="font-medium">Reported Date:</span> {new Date(issue.reportedDate).toLocaleString('en-GB')}</div>
                        <div><span className="font-medium">Odometer:</span> {issue.odometer.toLocaleString()} km</div>
                        <div><span className="font-medium">Priority:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityStyles[issue.priority].bg} ${priorityStyles[issue.priority].text}`}>{issue.priority}</span></div>
                        <div><span className="font-medium">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[issue.status].bg} ${statusStyles[issue.status].text}`}>{issue.status}</span></div>
                        {issue.isVehicleOutOfService && <div className="md:col-span-2 text-red-600 font-bold">Vehicle marked as Out of Service.</div>}
                    </div>

                    {/* Description & Photo */}
                    <div className="flex gap-6">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-800 mb-1">Description</h4>
                            <p className="p-3 bg-gray-50 rounded-md border text-gray-700 whitespace-pre-wrap">{issue.issueDescription}</p>
                        </div>
                        {issue.photoUrl && (
                            <div className="w-1/3">
                                <h4 className="font-medium text-gray-800 mb-1">Attachment</h4>
                                <a href={issue.photoUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={issue.photoUrl} alt={issue.photoName || 'Issue attachment'} className="rounded-md border object-cover max-h-40 w-full" />
                                </a>
                            </div>
                        )}
                    </div>
                     {/* Comments Section */}
                    <div>
                        <h4 className="font-medium text-gray-800 mb-1">Comments Log</h4>
                        <div className="p-3 bg-gray-50 rounded-md border h-40 overflow-y-auto space-y-4">
                            {parsedComments.length > 0 ? (
                                parsedComments.map(comment => (
                                    <div key={comment.id} className="text-sm">
                                        {comment.user && comment.timestamp && (
                                            <p className="font-semibold text-gray-800 border-b pb-1 mb-1">
                                                {comment.user}
                                                <span className="font-normal text-gray-500 text-xs ml-2">{comment.timestamp}</span>
                                            </p>
                                        )}
                                        <p className="text-gray-700 whitespace-pre-wrap">{comment.body}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-400">No comments yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 bg-gray-50 border-t space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Update Issue</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Change Status</label>
                            <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                <option value="">-- No Change --</option>
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Resolved">Resolved</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700">Add Comment</label>
                             <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <button onClick={handleDelete} className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md text-sm"><TrashIcon className="h-4 w-4 mr-1.5"/> Delete Issue</button>
                        <div className="flex space-x-3">
                           <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
                           <button onClick={handleUpdate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Save Update</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


const IssueManagement: React.FC = () => {
    const { issueLogs, vehicles, users } = useAppContext();
    const [selectedIssue, setSelectedIssue] = useState<IssueLog | null>(null);
    const [filters, setFilters] = useState({
        vehicleId: '',
        priority: '',
        status: '',
    });

    const filteredIssues = useMemo(() => {
        return issueLogs.filter(issue => {
            const vehicleMatch = !filters.vehicleId || issue.vehicleId === filters.vehicleId;
            const priorityMatch = !filters.priority || issue.priority === filters.priority;
            const statusMatch = !filters.status || issue.status === filters.status;
            return vehicleMatch && priorityMatch && statusMatch;
        });
    }, [issueLogs, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const clearFilters = () => {
        setFilters({ vehicleId: '', priority: '', status: '' });
    }

    const getVehicleName = (id: string) => vehicles.find(v => v.id === id)?.plateNumber || 'N/A';
    const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'N/A';

    return (
        <div className="max-w-7xl mx-auto">
            <IssueDetailModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
            <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Vehicle Issues</h2>
                <p className="text-gray-600 mt-1">Track and manage reported vehicle issues.</p>
            </div>
            
            {/* Filter Controls */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                  <select name="vehicleId" value={filters.vehicleId} onChange={handleFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    <option value="">All Vehicles</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select name="priority" value={filters.priority} onChange={handleFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    <option value="">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select name="status" value={filters.status} onChange={handleFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    <option value="">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
                <div className="self-end">
                    <button onClick={clearFilters} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Clear Filters</button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reported</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredIssues.length > 0 ? filteredIssues.map(issue => (
                            <tr key={issue.id} onClick={() => setSelectedIssue(issue)} className="hover:bg-gray-50 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getVehicleName(issue.vehicleId)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 truncate max-w-sm" title={issue.issueTitle}>{issue.issueTitle}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>{new Date(issue.reportedDate).toLocaleDateString('en-GB')}</div>
                                    <div className="text-xs">{getUserName(issue.reportedById)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${priorityStyles[issue.priority].bg} ${priorityStyles[issue.priority].text}`}>
                                        {issue.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[issue.status].bg} ${statusStyles[issue.status].text}`}>
                                        {issue.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="text-center py-12 text-gray-500">No issues match the current filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IssueManagement;
