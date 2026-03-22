import { redirect } from 'next/navigation';

export default function ArchPage({ params }: { params: { id: string } }) {
  redirect(`/app/${params.id}/architecture`);
}
