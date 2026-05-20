// Cycle 12 fix: server stub. School lookup is client-side in
// VisitFormResolver via useParams() so the page HTML is identical for
// every /form/[schoolId] URL — the SW can then cache one form page
// and serve it for any other school's URL offline.

import { VisitFormResolver } from "@/components/form/visit-form-resolver";

export default function VisitFormPage() {
  return <VisitFormResolver />;
}
