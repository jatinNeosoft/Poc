import { redirect } from "next/navigation";

// No public landing page in the POC: candidates come via /apply/[slug] links
export default function Home() {
  redirect("/admin");
}
