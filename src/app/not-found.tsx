import Link from "next/link";
import { NotAvailable } from "@/components/ui/layout";

export default function NotFound() {
  return (
    <div className="px-5">
      <NotAvailable title="Page not found" body="This address doesn't match anything you can open." />
      <div className="mx-auto max-w-md">
        <Link href="/my-work" className="text-body font-medium text-accent hover:text-accent-hover">
          Go to My Work
        </Link>
      </div>
    </div>
  );
}
