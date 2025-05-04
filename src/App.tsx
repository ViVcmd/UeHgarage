import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold accent-text">Garage Control</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [isOpening, setIsOpening] = useState(false);

  // Only fetch garage config if user is logged in
  const garageConfig = useQuery(api.garage.getConfig, loggedInUser ? {} : "skip");
  const openDoor = useMutation(api.garage.openDoor);

  // Admin features
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const authorizedUsers = useQuery(api.users.listAuthorizedUsers, loggedInUser ? {} : "skip");
  const addUser = useMutation(api.users.addAuthorizedUser);
  const removeUser = useMutation(api.users.removeAuthorizedUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  async function handleOpenDoor() {
    try {
      setIsOpening(true);
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by your browser");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      await openDoor({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      
      toast.success("Opening garage door");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open door");
    } finally {
      setIsOpening(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addUser({ email: newUserEmail, isAdmin });
      setNewUserEmail("");
      setIsAdmin(false);
      toast.success("User added successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add user");
    }
  }

  async function handleRemoveUser(email: string) {
    try {
      await removeUser({ email });
      toast.success("User removed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove user");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold accent-text mb-4">Garage Control</h1>
        <Authenticated>
          <p className="text-xl text-slate-600 mb-8">
            Welcome back, {loggedInUser?.email ?? "friend"}!
          </p>
          {garageConfig === undefined ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
          ) : (
            <button
              onClick={handleOpenDoor}
              disabled={isOpening}
              className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOpening ? "Opening..." : "Open Garage"}
            </button>
          )}

          {/* Admin Panel */}
          {authorizedUsers && (
            <div className="mt-12 text-left">
              <h2 className="text-2xl font-semibold mb-4">Manage Access</h2>
              
              {/* Add User Form */}
              <form onSubmit={handleAddUser} className="mb-8 p-4 border rounded-lg">
                <h3 className="text-lg font-medium mb-4">Add New User</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAdmin"
                      checked={isAdmin}
                      onChange={(e) => setIsAdmin(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700">
                      Grant admin privileges
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Add User
                  </button>
                </div>
              </form>

              {/* User List */}
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {authorizedUsers.map((user) => (
                      <tr key={user._id}>
                        <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.isAdmin ? "Admin" : "User"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleRemoveUser(user.email)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-slate-600 mb-8">
            Please sign in to access the garage
          </p>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <SignInForm />
            <p className="mt-4 text-sm text-gray-600">
              Only authorized users can access this application.
              Contact an administrator if you need access.
            </p>
          </div>
        </Unauthenticated>
      </div>
    </div>
  );
}
