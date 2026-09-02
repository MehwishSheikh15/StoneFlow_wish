import React, { useState, useEffect } from 'react';
import { User as UserIcon, ShieldCheck, Mail, Lock, UserPlus, Users, Trash2, CheckCircle, ArrowRight, ChevronDown, Coins } from 'lucide-react';
import { User } from '../types';
import { dbSync as dbMock } from '../lib/dbSync';

interface TeamManagementProps {
  currentUser: User;
  onToast: (msg: string, isWarn?: boolean) => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ currentUser, onToast }) => {
  const [teamList, setTeamList] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'office' | 'factory' | 'installer'>('office');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState(() => {
    return localStorage.getItem('stoneflow_currency') || 'gbp';
  });

  const handleCurrencyChange = (newCurrency: string) => {
    localStorage.setItem('stoneflow_currency', newCurrency);
    setSelectedCurrencyCode(newCurrency);
    window.dispatchEvent(new Event('stoneflow_currency_changed'));
    onToast(`Default system currency changed to ${newCurrency.toUpperCase()}`);
  };

  useEffect(() => {
    loadTeam();
    // Subscribe to updates so team updates in real-time
    const unsubscribe = dbMock.subscribe(() => {
      loadTeam();
    });
    return unsubscribe;
  }, []);

  const loadTeam = () => {
    setTeamList(dbMock.getUsers());
  };

  const handleOpenEdit = (member: User) => {
    setEditingMember(member);
    setEditEmail(member.email || '');
    setEditPassword(member.password || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    if (!editEmail.trim() || !editPassword.trim()) {
      onToast('Email and Password cannot be empty.', true);
      return;
    }

    try {
      await dbMock.updateUserEmail(editingMember.id, editEmail.trim(), editPassword.trim());
      onToast(`Updated credentials for ${editingMember.name} (${editEmail.trim()})`);
      setEditingMember(null);
      loadTeam();
    } catch (err: any) {
      onToast(err.message || 'Failed to update user credentials', true);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    const lowerEmail = email.toLowerCase().trim();

    // Check if email already exists
    const exists = teamList.some(u => (u.email || '').toLowerCase() === lowerEmail);
    if (exists) {
      setError('A team member with this email is already registered.');
      return;
    }

    // Generate initials and avatarBg
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'TM';

    const bgColors = {
      owner: 'bg-indigo-600 text-white',
      office: 'bg-zinc-600 text-white',
      factory: 'bg-teal-600 text-white',
      installer: 'bg-amber-600 text-white'
    };
    const avatarBg = bgColors[role] || 'bg-zinc-600 text-white';

    const newMember = {
      name: name.trim(),
      email: lowerEmail,
      password: password,
      role,
      initials,
      avatarBg
    };

    const registered = dbMock.registerUser(newMember);

    // Clear form & reload
    setName('');
    setEmail('');
    setPassword('');
    setRole('office');
    loadTeam();
    onToast(`Successfully added team member: ${registered.name}`);
  };

  const handleRemoveMember = async (userId: string) => {
    const member = teamList.find(u => u.id === userId);
    if (member?.role === 'owner' || userId === 'u-1') {
      onToast('The owner role cannot be deleted.', true);
      return;
    }

    await dbMock.hardDeleteUser(userId);
    loadTeam();
    setConfirmDeleteId(null);
    onToast(`Completed Task: Delete Team Member - ${member?.name || userId}`);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-disp font-extrabold text-ink tracking-tight">Team Management</h1>
          <p className="text-sm text-mut mt-1.5">Manage and register your designers, office staff, installers, and fabricators.</p>
        </div>

        {/* Currency Converter Selector */}
        <div className="flex items-center gap-2 bg-paper border border-line px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-sm w-fit self-start sm:self-center">
          <Coins className="w-4.5 h-4.5 text-sap" />
          <span className="text-mut uppercase text-[10px] tracking-wider font-bold">Default Currency:</span>
          <select
            value={selectedCurrencyCode}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="bg-transparent border-none outline-none font-extrabold text-ink cursor-pointer focus:ring-0 p-0 pr-1 text-xs"
          >
            <option value="gbp">UK (£)</option>
            <option value="usd">USA ($)</option>
            <option value="eur">Europe (€)</option>
            <option value="aud">Australia (A$)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="lg:col-span-1 bg-paper border border-line rounded-2xl p-6 shadow-sm space-y-6 h-fit">
          <div className="flex items-center gap-2.5 pb-4 border-b border-soft">
            <div className="p-2 bg-am/10 text-am rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-disp font-bold text-ink">Register Crew / Staff</h2>
              <p className="text-[10px] text-mut uppercase font-semibold">Workspace Access Credentials</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rubysoft text-ruby text-xs rounded-xl border border-ruby/10 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-xl text-sm focus:outline-none focus:border-sap"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-mut absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@stoneflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-paper border border-line rounded-xl text-sm focus:outline-none focus:border-sap"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Initial Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-mut absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-paper border border-line rounded-xl text-sm focus:outline-none focus:border-sap"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Enterprise Role</label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-paper border border-line rounded-xl text-sm focus:outline-none focus:border-sap appearance-none pr-10"
                >
                  <option value="owner">Company Owner / Managing Director</option>
                  <option value="office">Office Staff / Designer / Sales</option>
                  <option value="factory">Factory Operator / Mason / Cutter</option>
                  <option value="installer">On-Site Installer / Fitter</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-mut">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-sidebg hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-black py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-sm cursor-pointer"
            >
              Add Team Member
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Current Crew / Team List */}
        <div className="lg:col-span-2 bg-paper border border-line rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-soft">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sap/10 text-sap rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-disp font-bold text-ink">Active Enterprise Directory</h2>
                <p className="text-[10px] text-mut uppercase font-semibold">Total Crew: {teamList.length}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {teamList.map((member, idx) => {
              const isOwner = member.role === 'owner';
              const isPredef = ['u-1', 'u-2', 'u-3', 'u-4'].includes(member.id);

              return (
                <div 
                  key={`${member.id || 'u'}-${idx}`} 
                  className="flex items-center justify-between p-4 bg-soft/40 hover:bg-soft/75 border border-line rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-disp font-bold text-sm ${member.avatarBg || 'bg-zinc-600 text-white'}`}>
                      {member.initials}
                    </div>
                    <div>
                      <div className="font-disp font-bold text-ink text-sm flex items-center gap-2">
                        {member.name}
                        {isOwner && (
                          <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                            <ShieldCheck className="w-3 h-3" />
                            Owner
                          </span>
                        )}
                        {!isOwner && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            member.role === 'office' ? 'bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 border-zinc-200' :
                            member.role === 'factory' ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400 border-teal-200' :
                            'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200'
                          }`}>
                            {member.role === 'office' ? 'Office / Designer' : member.role === 'factory' ? 'Factory Cutter' : 'Installer'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-mut font-medium mt-1.5 space-y-1">
                        <div>
                          <span className="font-bold text-ink">Email:</span> <span className="font-mono text-ink2">{member.email || `${member.name.toLowerCase().replace(/\s+/g, '')}@stoneflow.com`}</span>
                        </div>
                        {member.password && (
                          <div>
                            <span className="font-bold text-ink">Password:</span> <span className="font-mono bg-soft px-1.5 py-0.5 rounded text-[11px] text-ink">{member.password}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(member)}
                      className="px-2.5 py-1.5 bg-paper border border-line text-ink hover:text-sap hover:border-sap/40 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1"
                      title="Change Email or Reset Password"
                    >
                      <Lock className="w-3 h-3 text-sap" />
                      Credentials
                    </button>

                    {isOwner ? (
                      <span className="text-[10px] font-bold text-mut bg-soft px-2.5 py-1 rounded-lg">OWNER</span>
                    ) : confirmDeleteId === member.id ? (
                      <div className="flex items-center gap-1.5 animate-scale-in">
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="px-2.5 py-1.5 bg-ruby hover:bg-ruby/95 text-white text-[11px] font-extrabold rounded-lg transition-all cursor-pointer shadow-sm"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-ink text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(member.id)}
                        className="p-2 text-mut hover:text-ruby hover:bg-rubysoft rounded-xl transition-all cursor-pointer"
                        title="Delete Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Owner Credential Management Modal (Hostinger-style Forget Password / Change Email) */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper border border-line rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-soft">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sap/10 text-sap rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-disp font-bold text-ink">Update Credentials</h3>
                  <p className="text-xs text-mut">{editingMember.name} ({editingMember.role.toUpperCase()})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-mut hover:text-ink text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink uppercase tracking-wide">Change Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-mut absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-soft border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap"
                    placeholder="newemail@stoneflow.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink uppercase tracking-wide">Reset Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-mut absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-soft border border-line rounded-xl text-sm font-mono text-ink focus:outline-none focus:border-sap"
                    placeholder="Enter new password"
                  />
                </div>
                <p className="text-[10px] text-mut">Owner / Hostinger style direct password reset &amp; email update.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-soft text-ink rounded-xl text-xs font-bold hover:bg-soft/80 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sap text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md cursor-pointer"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
