import React from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  Bell, 
  GitBranch, 
  PenSquare, 
  Plus, 
  Layers, 
  MapPin, 
  Receipt,
  Scissors,
  ClipboardCheck,
  Building,
  Factory,
  Users,
  Moon,
  Sun
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  workspace: 'office' | 'factory';
  onWorkspaceChange: (ws: 'office' | 'factory') => void;
  currentPage: string;
  onPageChange: (page: string) => void;
  currentUser: User;
  warningsCount: number;
  invoiceCount: number;
  className?: string;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  workspace,
  onWorkspaceChange,
  currentPage,
  onPageChange,
  currentUser,
  warningsCount,
  invoiceCount,
  className,
  theme,
  onThemeToggle,
  onLogout
}) => {
  // Navigation structure per workspace
  const officeNav = [
    {
      group: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'all-jobs', label: 'All Jobs', icon: ListTodo },
        { id: 'warnings', label: 'Warnings', icon: Bell, badge: warningsCount, badgeColor: 'hot' },
        { id: 'team', label: 'Team', icon: Users }
      ]
    },
    {
      group: 'Workflow',
      items: [
        { id: 'sales-pipeline', label: 'Sales Pipeline', icon: GitBranch },
        { id: 'design-approval', label: 'Design & Approval', icon: PenSquare }
      ]
    },
    {
      group: 'Operations',
      items: [
        { id: 'materials', label: 'Materials', icon: Layers },
        { id: 'installations', label: 'Installations', icon: MapPin }
      ]
    },
    {
      group: 'Accounts',
      items: [
        { id: 'billing-closed', label: 'Invoices', icon: Receipt, badge: invoiceCount, badgeColor: 'warm' }
      ]
    }
  ];

  const factoryNav = [
    {
      group: 'Shop Floor',
      items: [
        { id: 'cutting-queue', label: 'Cutting Queue', icon: Scissors },
        { id: 'qc-station', label: 'QC Station', icon: ClipboardCheck },
        { id: 'installations', label: 'Install Schedule', icon: MapPin }
      ]
    }
  ];

  // Filter navigation per user role
  const getFilteredNav = () => {
    const role = currentUser.role;
    let baseNav = officeNav;
    if (role === 'owner') {
      baseNav = workspace === 'office' ? officeNav : factoryNav;
    } else if (role === 'factory') {
      baseNav = [
        {
          group: 'Shop Floor',
          items: [
            { id: 'cutting-queue', label: 'Cutting Queue', icon: Scissors },
            { id: 'qc-station', label: 'QC Station', icon: ClipboardCheck }
          ]
        }
      ];
    } else if (role === 'installer') {
      baseNav = [
        {
          group: 'Installation',
          items: [
            { id: 'installations', label: 'Install Schedule', icon: MapPin }
          ]
        }
      ];
    }

    if (role !== 'owner') {
      return baseNav.map(group => ({
        ...group,
        items: group.items.filter(item => item.id !== 'warnings' && item.id !== 'team' && item.id !== 'billing-closed')
      })).filter(group => group.items.length > 0);
    }
    return baseNav;
  };

  const currentNav = getFilteredNav();

  return (
    <aside className={`side ${collapsed ? 'min' : ''} ${className || ''}`}>
      {/* Brand */}
      <div className="brand">
        <div className="bmark">SF</div>
        <div className="lbl">
          <div className="bname">StoneFlow</div>
          <div className="bsub">Workflow OS</div>
        </div>
      </div>

      {/* Workspace Switcher - only visible to owners */}
      {currentUser.role === 'owner' && (
        <div className="wsw">
          <button 
            onClick={() => onWorkspaceChange('office')}
            className={`wbtn ${workspace === 'office' ? 'on' : ''}`}
          >
            <span className="nico"><Building className="w-4 h-4" /></span>
            <span className="lbl">Office</span>
          </button>
          <button 
            onClick={() => onWorkspaceChange('factory')}
            className={`wbtn ${workspace === 'factory' ? 'on' : ''}`}
          >
            <span className="nico"><Factory className="w-4 h-4" /></span>
            <span className="lbl">Factory</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="nav">
        {currentNav.map((group, gIdx) => (
          <div key={gIdx}>
            <div className="ngl lbl">{group.group}</div>
            {group.items.map((item: any) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`nitem ${isActive ? 'on' : ''}`}
                >
                  <span className="nico"><Icon className="w-4.5 h-4.5" /></span>
                  <span className="f1 lbl">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`nbadge lbl ${item.badgeColor || ''}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Quick Create Button */}
      {workspace === 'office' && (
        <button
          onClick={() => onPageChange('create-job')}
          className="quickc"
        >
          <span className="nico"><Plus className="w-5 h-5" /></span>
          <span className="lbl">Quick Create</span>
        </button>
      )}

      {/* User Footer */}
      <div className="suser">
        <div className="sav">{currentUser.initials}</div>
        <div className="lbl">
          <div className="sun1">{currentUser.name}</div>
          <div className="sur">{currentUser.role === 'owner' ? 'Owner / Director' : currentUser.role}</div>
        </div>
      </div>
    </aside>
  );
};

