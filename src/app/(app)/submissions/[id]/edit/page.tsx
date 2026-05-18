import { EditSubmission } from "@/components/submissions/edit-submission";

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditSubmission id={id} />;
}
