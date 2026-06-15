import { RecruitmentBoardPage } from "@/features/recruitment/components/recruitment-board-page";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { jobId } = await params;
  return <RecruitmentBoardPage jobId={jobId} />;
}
