import { redirect } from 'next/navigation';

export default function PrdPage({ params }: { params: { id: string } }) {
  redirect(`/app/${params.id}/requirements`);
}
