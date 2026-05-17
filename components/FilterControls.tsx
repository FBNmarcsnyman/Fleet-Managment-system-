
import React from 'react';
import { SearchIcon } from './icons/SearchIcon';

interface FilterControlsProps {
    filters: { branch: string; weightCategory: string; searchQuery: string; };
    onFilterChange: React.Dispatch<React.SetStateAction<{ branch: string; weightCategory: string; searchQuery: string; }>>;
    branches: string[];
    weightCategories: string[];
}

const FilterControls: React.FC<FilterControlsProps> = ({ filters, onFilterChange, branches, weightCategories }) => {

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        onFilterChange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const selectClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";
    const inputClasses = `${selectClasses} pl-10`;

    return (
        <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="branch-filter" className="block text-sm font-medium text-gray-300 mb-1">
                        Filter by Branch
                    </label>
                    <select
                        id="branch-filter"
                        name="branch"
                        value={filters.branch}
                        onChange={handleFilterChange}
                        className={selectClasses}
                    >
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="weight-filter" className="block text-sm font-medium text-gray-300 mb-1">
                        Filter by Vehicle Category
                    </label>
                    <select
                        id="weight-filter"
                        name="weightCategory"
                        value={filters.weightCategory}
                        onChange={handleFilterChange}
                        className={selectClasses}
                    >
                        <option value="All">All</option>
                        {weightCategories.map(wc => <option key={wc} value={wc}>{wc}</option>)}
                    </select>
                </div>
                <div className="relative">
                     <label htmlFor="search-query" className="block text-sm font-medium text-gray-300 mb-1">
                        Search by Name/Reg
                    </label>
                    <div className="absolute inset-y-0 left-0 top-6 pl-3 flex items-center pointer-events-none">
                       <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        id="search-query"
                        name="searchQuery"
                        value={filters.searchQuery}
                        onChange={handleFilterChange}
                        className={inputClasses}
                        placeholder="e.g. Work Ute or UTE-001"
                    />
                </div>
            </div>
        </div>
    )
};

export default FilterControls;
