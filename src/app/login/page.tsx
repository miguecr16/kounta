import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  query.set('mode', 'signin');
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'mode' && typeof value === 'string') {
        query.set(key, value);
      }
    }
  }

  redirect(`/auth?${query.toString()}`);
}
