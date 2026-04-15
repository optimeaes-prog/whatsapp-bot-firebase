import { useEffect, useState } from "react";
import { Users as UsersIcon, Search, Mail, Calendar, LogIn } from "lucide-react";
import { getSystemUsers, type SystemUser } from "../services/users";
import { formatDate } from "../lib/utils";
import { PageHeader, FilterCard, PageLoading } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export function Users() {
  const { organizationId } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, [organizationId]);

  async function loadUsers() {
    if (!organizationId) return;
    try {
      setLoading(true);
      const data = await getSystemUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(searchLower) ||
      u.displayName?.toLowerCase().includes(searchLower) ||
      u.uid.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <PageLoading message="Cargando usuarios..." className="h-64" />;
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Usuarios"
        subtitle="Gestión de los clientes registrados (usuarios de Proplead)"
        icon={<UsersIcon className="text-primary-600" size={32} />}
      />

      {/* Filters */}
      <FilterCard className="mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por email, nombre o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 flex items-center justify-center whitespace-nowrap font-heading">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'Usuario' : 'Usuarios'}
          </div>
        </div>
      </FilterCard>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <UsersIcon className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 font-heading">No se encontraron usuarios</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              No hay ningún usuario que coincida con tu búsqueda. Intenta usar otros términos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell font-heading">
                    ID Entidad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider font-heading">
                    Fecha Registro
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider font-heading">
                    Último Acceso
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="transition-colors hover:bg-primary-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700 shadow-inner font-heading">
                          {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 font-heading">
                            {user.displayName || "Sin nombre"}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-body">
                            <Mail size={12} className="text-gray-400" />
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono hidden md:table-cell">
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1 inline-block text-xs">
                        {user.uid}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        {user.creationTime ? formatDate(new Date(user.creationTime)) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <LogIn size={14} className="text-primary-400" />
                        {user.lastSignInTime ? formatDate(new Date(user.lastSignInTime)) : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
