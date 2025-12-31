export default function Unauthorized() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-gray-600">You don’t have permission to view this page.</p>
    </div>
  );
}
