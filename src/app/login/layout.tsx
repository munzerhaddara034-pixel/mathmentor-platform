import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
