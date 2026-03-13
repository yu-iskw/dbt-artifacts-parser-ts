interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      style={{
        padding: "1rem",
        background: "#fee",
        border: "1px solid #c00",
        borderRadius: 8,
        marginBottom: "1rem",
      }}
    >
      {message}
    </div>
  );
}
