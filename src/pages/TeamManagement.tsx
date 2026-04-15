import { useEffect, useState } from "react";
import { Users as UsersIcon, Search, Mail, Calendar, UserPlus, ShieldCheck, Shield, Trash2, X, Plus, LogIn } from "lucide-react";
import { getOrgMembers, getOrgInvitations, sendInvitation, deleteInvitation, removeUserFromOrg, type SystemUser, type Invitation } from "../services/users";
import { formatDate } from "../lib/utils";
import { PageHeader, FilterCard, PageLoading, Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export function TeamManagement() {
  const { organizationId, role, user: currentUser } = useAuth();
  const [members, setMembers] = useState<SystemUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  async function loadData() {
    if (!organizationId) return;
    try {
      setLoading(true);
      const [membersData, invitationsData] = await Promise.all([
        getOrgMembers(organizationId),
        getOrgInvitations(organizationId)
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (error) {
      console.error("Error loading team data:", error);
      toast.error("Error al cargar los datos del equipo");
    } finally {
      setLoading(false);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    setInviting(true);
    try {
      await sendInvitation({
        email: inviteEmail,
        name: inviteName,
        role: inviteRole
      });
      toast.success("Invitación enviada correctamente");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Error al enviar la invitación");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (user: SystemUser) => {
    if (user.uid === currentUser?.uid) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    if (user.role === 'owner') {
        toast.error("No se puede eliminar al propietario de la organización");
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar a ${user.name} del equipo?`)) return;

    try {
      await removeUserFromOrg(user.uid);
      toast.success("Usuario eliminado correctamente");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar el usuario");
    }
  };

  const handleDeleteInvite = async (invitationId: string) => {
      if (!confirm("¿Estás seguro de que quieres cancelar esta invitación?")) return;
      try {
          await deleteInvitation(invitationId);
          toast.success("Invitación cancelada");
          loadData();
      } catch (error) {
          toast.error("Error al cancelar la invitación");
      }
  };

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.email.toLowerCase().includes(searchLower) ||
      m.name?.toLowerCase().includes(searchLower)
    );
  });

  const canManageTeam = role === 'owner' || role === 'admin';

  if (loading) {
    return <PageLoading message="Cargando equipo..." className="h-64" />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <PageHeader
          title="Gestión de Equipo"
          subtitle="Administra los usuarios y permisos de tu organización"
          icon={<UsersIcon className="text-primary-600" size={32} />}
        />
        {canManageTeam && (
          <Button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2">
            <UserPlus size={18} />
            Invitar Usuario
          </Button>
        )}
      </div>

      {/* Stats & Search */}
      <FilterCard className="mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50/50"
            />
          </div>
          <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-1">
            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm min-w-[120px] text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Activos</p>
              <p className="text-2xl font-black text-slate-900 font-heading">{members.length}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm min-w-[120px] text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Pendientes</p>
              <p className="text-2xl font-black text-amber-600 font-heading">{invitations.filter(i => i.status === 'pending').length}</p>
            </div>
          </div>
        </div>
      </FilterCard>

      <div className="space-y-10">
        {/* Members Table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 font-heading">Miembros del equipo</h3>
              <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Activos</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Usuario</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Rol</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Registro</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMembers.map((member) => (
                    <tr key={member.uid} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shadow-inner">
                            {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 font-heading truncate">{member.name}</span>
                            <span className="text-xs text-gray-500 font-body">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          member.role === 'owner' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                          member.role === 'admin' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                          "bg-gray-50 text-gray-600 border border-gray-100"
                        )}>
                          {member.role === 'owner' ? <ShieldCheck size={12} /> : member.role === 'admin' ? <Shield size={12} /> : null}
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-body">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(new Date(member.createdAt))}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {canManageTeam && member.uid !== currentUser?.uid && member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveUser(member)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Eliminar usuario"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMembers.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-gray-400 text-sm italic">No se encontraron miembros</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Invitations Table */}
        {invitations.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-gray-900 font-heading">Invitaciones enviadas</h3>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Pendientes</span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Invitado</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Rol</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Expira</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invitations.map((invite) => (
                      <tr key={invite.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 font-heading">{invite.name}</span>
                            <span className="text-xs text-gray-500 font-body">{invite.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold rounded uppercase tracking-wider border border-gray-100">
                            {invite.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500 font-body">
                            {formatDate(new Date(invite.expiresAt))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canManageTeam && (
                            <button
                                onClick={() => handleDeleteInvite(invite.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Cancelar invitación"
                            >
                                <X size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !inviting && setShowInviteModal(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="bg-primary-500 h-2 w-full"></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 italic tracking-tight font-heading flex items-center gap-2">
                    <UserPlus className="text-primary-500" size={24} />
                    Invitar al equipo
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">Escribe los detalles de la persona que quieres invitar.</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                  disabled={inviting}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej: juan@inmobiliaria.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Rol en el equipo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteRole("member")}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center",
                        inviteRole === "member" ? "border-primary-500 bg-primary-50" : "border-slate-100 grayscale hover:grayscale-0 hover:border-slate-200"
                      )}
                    >
                      <UsersIcon size={20} className={inviteRole === "member" ? "text-primary-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold mt-2", inviteRole === "member" ? "text-primary-700" : "text-slate-500")}>Miembro</span>
                      <span className="text-[9px] text-slate-400 mt-1">Solo lectura</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole("admin")}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center",
                        inviteRole === "admin" ? "border-primary-500 bg-primary-50" : "border-slate-100 grayscale hover:grayscale-0 hover:border-slate-200"
                      )}
                    >
                      <Shield size={20} className={inviteRole === "admin" ? "text-primary-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold mt-2", inviteRole === "admin" ? "text-primary-700" : "text-slate-500")}>Admin</span>
                      <span className="text-[9px] text-slate-400 mt-1">Gestión total</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full py-4 rounded-2xl shadow-xl shadow-primary-200" loading={inviting}>
                    <Plus size={18} className="mr-2" />
                    Enviar Invitación
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
