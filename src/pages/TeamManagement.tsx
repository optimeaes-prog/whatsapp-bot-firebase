import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users as UsersIcon, Search, Calendar, UserPlus, ShieldCheck, Shield, Trash2, X, Plus, Pencil, Eye } from "lucide-react";
import {
  getOrgMembers,
  getOrgInvitations,
  sendInvitation,
  deleteInvitation,
  removeUserFromOrg,
  updateTeamMember,
  type SystemUser,
  type Invitation,
  type UpdateTeamMemberParams,
} from "../services/users";
import { formatDate } from "../lib/utils";
import { PageHeader, FilterCard, PageLoading, Button } from "../components/ui";
import { pendingPillSm } from "../lib/metricTheme";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";

type EditableTeamRole = "member" | "agent" | "admin";

/** Roles that cannot use the normal role dropdown; super_admin edits name + WhatsApp only. */
type ProtectedTeamRole = "owner" | "super_admin";

type EditMemberForm = {
  name: string;
  role: EditableTeamRole | ProtectedTeamRole;
  qualifiedLeadNotificationNumbers: string;
};

export function TeamManagement() {
  const navigate = useNavigate();
  const {
    organizationId,
    role,
    effectiveRole,
    user: currentUser,
    isImpersonationReadOnly,
    startImpersonation,
  } = useAuth();
  /** Real signed-in role (not affected by "ver como"); super_admin retains full team edits. */
  const authRole = role;
  const [members, setMembers] = useState<SystemUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "agent">("member");
  const [inviting, setInviting] = useState(false);
  const [editingMember, setEditingMember] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState<EditMemberForm>({
    name: "",
    role: "member",
    qualifiedLeadNotificationNumbers: "",
  });
  const [savingMember, setSavingMember] = useState(false);
  const [viewAsLoadingUid, setViewAsLoadingUid] = useState<string | null>(null);
  const canManageTeam =
    effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "super_admin";

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
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
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
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    if (user.uid === currentUser?.uid) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    if (user.role === 'owner' || user.role === "super_admin") {
        toast.error("No se puede eliminar un rol protegido de la organización");
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

  const handleViewAs = async (member: SystemUser) => {
    if (member.uid === currentUser?.uid) {
      toast.error("Selecciona otro miembro del equipo");
      return;
    }
    setViewAsLoadingUid(member.uid);
    try {
      await startImpersonation(member.uid);
      toast.success(`Viendo la app como ${member.name || member.email}`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar la vista");
    } finally {
      setViewAsLoadingUid(null);
    }
  };

  const handleDeleteInvite = async (invitationId: string) => {
      if (isImpersonationReadOnly) {
        toast.message("Solo lectura en modo vista como usuario");
        return;
      }
      if (!confirm("¿Estás seguro de que quieres cancelar esta invitación?")) return;
      try {
          await deleteInvitation(invitationId);
          toast.success("Invitación cancelada");
          loadData();
      } catch (error) {
          toast.error("Error al cancelar la invitación");
      }
  };

  const normalizeEditableRole = (memberRole: string): EditableTeamRole => {
    if (memberRole === "admin" || memberRole === "agent" || memberRole === "member") return memberRole;
    return "member";
  };

  const isProtectedTeamRole = (r: string) => r === "owner" || r === "super_admin";

  const canEditMember = (member: SystemUser) => {
    if (isImpersonationReadOnly) return false;
    if (authRole === "super_admin") return true;
    return canManageTeam && !isProtectedTeamRole(member.role);
  };

  const openEditMember = (member: SystemUser) => {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    if (!canEditMember(member)) return;
    setEditingMember(member);
    const protectedR = isProtectedTeamRole(member.role);
    setEditForm({
      name: member.name || member.displayName || "",
      role: protectedR && authRole === "super_admin" ? (member.role as ProtectedTeamRole) : normalizeEditableRole(member.role),
      qualifiedLeadNotificationNumbers: member.qualifiedLeadNotificationNumbers || "",
    });
  };

  const closeEditMember = () => {
    if (savingMember) return;
    setEditingMember(null);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    if (!editingMember || !organizationId) return;

    const name = editForm.name.trim();
    if (!name) {
      toast.error("Introduce un nombre para el usuario");
      return;
    }

    setSavingMember(true);
    try {
      const resolvedRole =
        isProtectedTeamRole(editingMember.role) && authRole === "super_admin"
          ? editingMember.role
          : editForm.role;
      await updateTeamMember({
        orgId: organizationId,
        userId: editingMember.uid,
        name,
        role: resolvedRole as UpdateTeamMemberParams["role"],
        qualifiedLeadNotificationNumbers:
          resolvedRole === "member" ? "" : editForm.qualifiedLeadNotificationNumbers.trim(),
      });
      toast.success("Usuario actualizado correctamente");
      setEditingMember(null);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el usuario");
    } finally {
      setSavingMember(false);
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
          <Button
            onClick={() => setShowInviteModal(true)}
            disabled={isImpersonationReadOnly}
            className="flex items-center gap-2"
          >
            <UserPlus size={18} />
            Invitar Usuario
          </Button>
        )}
      </div>

      {/* Stats & Search */}
      <FilterCard className="mb-8">
        <p className="text-sm text-gray-600 font-body mb-4">
          Los roles distintos de <span className="font-semibold text-gray-800">member</span> pueden indicar un WhatsApp para recibir{" "}
          resúmenes de leads cualificados cuando les corresponda un anuncio asignado. Los números configurados en{" "}
          <span className="font-semibold text-gray-800">Configuración</span> siempre reciben todas las notificaciones.
        </p>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Usuario</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Rol</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading max-w-[220px]">
                      WhatsApp resúmenes
                    </th>
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
                          member.role === 'owner' ? "bg-primary-50 text-primary-700 border border-primary-100" :
                          member.role === 'admin' ? "bg-slate-100 text-slate-700 border border-slate-200" :
                          "bg-gray-50 text-gray-600 border border-gray-100"
                        )}>
                          {member.role === 'owner' ? <ShieldCheck size={12} /> : member.role === 'admin' ? <Shield size={12} /> : null}
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-top">
                        {member.role === "member" ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <span className="text-xs text-gray-700 font-body break-all">
                            {member.qualifiedLeadNotificationNumbers?.trim() ? (
                              member.qualifiedLeadNotificationNumbers.trim()
                            ) : (
                              <span className="text-gray-400 italic">Sin configurar</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-body">
                          <Calendar size={14} className="text-gray-400" />
                          {member.createdAt ? formatDate(new Date(member.createdAt)) : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1">
                          {role === "super_admin" && member.uid !== currentUser?.uid && (
                            <button
                              type="button"
                              onClick={() => void handleViewAs(member)}
                              disabled={viewAsLoadingUid === member.uid}
                              className="p-2 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-btn transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
                              title="Ver la app como este usuario (solo lectura)"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          {canEditMember(member) && (
                            <button
                              type="button"
                              onClick={() => openEditMember(member)}
                              className="p-2 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-btn transition-all opacity-0 group-hover:opacity-100"
                              title="Editar usuario"
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          {canManageTeam && member.uid !== currentUser?.uid && member.role !== 'owner' && member.role !== "super_admin" && (
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(member)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-btn transition-all opacity-0 group-hover:opacity-100"
                              title="Eliminar usuario"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
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
                <span className={pendingPillSm}>Pendientes</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Invitado</th>
                      <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Estado</th>
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
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border",
                              invite.status === "accepted"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : invite.status === "expired"
                                  ? "bg-red-50 text-red-700 border-red-100"
                                  : "bg-amber-50 text-amber-700 border-amber-100"
                            )}
                          >
                            {invite.status}
                          </span>
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

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeEditMember}></div>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="bg-primary-500 h-2 w-full"></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 italic tracking-tight font-heading flex items-center gap-2">
                    <Pencil className="text-primary-500" size={24} />
                    Editar usuario
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">Actualiza los permisos y preferencias del miembro.</p>
                </div>
                <button
                  onClick={closeEditMember}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-btn transition-all"
                  disabled={savingMember}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateMember} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Nombre visible</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={editingMember.email}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-400">El email pertenece a Firebase Auth y no se cambia desde Equipo.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Rol en el equipo</label>
                  {editForm.role === "owner" || editForm.role === "super_admin" ? (
                    <>
                      <input
                        type="text"
                        value={editForm.role}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wide outline-none"
                      />
                      <p className="mt-2 text-xs text-slate-400">
                        Rol protegido. Como super admin solo puedes actualizar nombre y WhatsApp de resúmenes.
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as EditableTeamRole }))}
                        disabled={editingMember.uid === currentUser?.uid}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all bg-white disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="member">Miembro - solo lectura</option>
                        <option value="agent">Agente - anuncios y leads asignados</option>
                        <option value="admin">Admin - gestión total</option>
                      </select>
                      {editingMember.uid === currentUser?.uid && (
                        <p className="mt-2 text-xs text-slate-400">No puedes cambiar tu propio rol desde esta pantalla.</p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">WhatsApp resúmenes</label>
                  <input
                    type="text"
                    value={editForm.qualifiedLeadNotificationNumbers}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, qualifiedLeadNotificationNumbers: e.target.value }))}
                    disabled={editForm.role === "member"}
                    placeholder="34696000111, 34696000222"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Para admins, agentes y owner: número extra cuando les toca un anuncio asignado (los de Configuración siempre reciben todo).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-btn"
                    onClick={closeEditMember}
                    disabled={savingMember}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 rounded-btn shadow-xl shadow-primary-200" loading={savingMember}>
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteRole("member")}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-xl border-2 transition-all text-center",
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
                        "flex flex-col items-center p-4 rounded-xl border-2 transition-all text-center",
                        inviteRole === "admin" ? "border-primary-500 bg-primary-50" : "border-slate-100 grayscale hover:grayscale-0 hover:border-slate-200"
                      )}
                    >
                      <Shield size={20} className={inviteRole === "admin" ? "text-primary-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold mt-2", inviteRole === "admin" ? "text-primary-700" : "text-slate-500")}>Admin</span>
                      <span className="text-[9px] text-slate-400 mt-1">Gestión total</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteRole("agent")}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-xl border-2 transition-all text-center",
                        inviteRole === "agent" ? "border-primary-500 bg-primary-50" : "border-slate-100 grayscale hover:grayscale-0 hover:border-slate-200"
                      )}
                    >
                      <ShieldCheck size={20} className={inviteRole === "agent" ? "text-primary-600" : "text-slate-400"} />
                      <span className={cn("text-xs font-bold mt-2", inviteRole === "agent" ? "text-primary-700" : "text-slate-500")}>Agente</span>
                      <span className="text-[9px] text-slate-400 mt-1">Anuncios + leads</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" variant="cta" loading={inviting}>
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
