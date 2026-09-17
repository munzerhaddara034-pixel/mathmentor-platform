"use client";

export function LogoutButton() {
  return (
    <button
      className="ghost"
      type="button"
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
          window.location.href = "/login";
        });
      }}
    >
      خروج
    </button>
  );
}
