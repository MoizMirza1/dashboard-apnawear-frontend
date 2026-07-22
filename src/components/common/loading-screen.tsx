export default function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="loading-screen">
      <div className="loader" />
      <p>{message}</p>
    </div>
  );
}
