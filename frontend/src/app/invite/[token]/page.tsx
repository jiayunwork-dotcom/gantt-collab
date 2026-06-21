'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectsApi, authApi } from '@/lib/api';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const accept = async () => {
      const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!t) {
        router.push(`/login?redirect=/invite/${token}`);
        return;
      }
      try {
        const project = await projectsApi.acceptInvitation(token);
        setProjectName(project.name);
        setStatus('success');
        setTimeout(() => {
          router.push(`/projects/${project.id}`);
        }, 2000);
      } catch (err: any) {
        setError(err.response?.data?.message || '邀请链接无效或已过期');
        setStatus('error');
      }
    };
    accept();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <div>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">正在加入项目...</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">加入成功</h2>
            <p className="text-gray-600 mb-4">您已成功加入项目: {projectName}</p>
            <p className="text-sm text-gray-400">即将跳转...</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">加入失败</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              返回项目列表
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
