import { redirect } from "next/navigation";
import { privateRobotsMetadata } from "@/lib/auth/metadata";

export const metadata = privateRobotsMetadata;

export default function ActivatePage() {
  redirect("/redeem");
}
