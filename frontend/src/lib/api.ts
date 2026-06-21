import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type {
  User,
  Project,
  Task,
  Dependency,
  Collaborator,
  Resource,
  ResourceWorkload,
  Baseline,
  CollaboratorRole,
  ActivityLog,
  PaginatedActivityLogs,
  ActionType,
} from './types';

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const extractData = <T>(response: AxiosResponse<T>): T => response.data;

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data).then(extractData),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data).then(extractData),
  me: () => api.get<User>('/auth/me').then(extractData),
};

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then(extractData),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then(extractData),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data).then(extractData),
  update: (id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data).then(extractData),
  remove: (id: string) => api.delete<void>(`/projects/${id}`).then(extractData),
  listCollaborators: (id: string) =>
    api.get<Collaborator[]>(`/projects/${id}/collaborators`).then(extractData),
  addCollaborator: (id: string, data: { userId: string; role: CollaboratorRole }) =>
    api.post<Collaborator>(`/projects/${id}/collaborators`, data).then(extractData),
  updateCollaborator: (id: string, collaboratorId: string, role: CollaboratorRole) =>
    api.patch<Collaborator>(`/projects/${id}/collaborators/${collaboratorId}`, { role }).then(extractData),
  removeCollaborator: (id: string, collaboratorId: string) =>
    api.delete<void>(`/projects/${id}/collaborators/${collaboratorId}`).then(extractData),
  createInvitation: (id: string, data: { role: CollaboratorRole; expiresInDays?: number }) =>
    api.post<{ token: string }>(`/projects/${id}/invitations`, data).then(extractData),
  acceptInvitation: (token: string) =>
    api.post<Project>('/projects/invitations/accept', { token }).then(extractData),
};

export const tasksApi = {
  list: (projectId: string) => api.get<Task[]>(`/projects/${projectId}/tasks`).then(extractData),
  get: (projectId: string, taskId: string) =>
    api.get<Task>(`/projects/${projectId}/tasks/${taskId}`).then(extractData),
  create: (projectId: string, data: Partial<Task>) =>
    api.post<Task>(`/projects/${projectId}/tasks`, data).then(extractData),
  update: (projectId: string, taskId: string, data: Partial<Task>) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, data).then(extractData),
  remove: (projectId: string, taskId: string) =>
    api.delete<void>(`/projects/${projectId}/tasks/${taskId}`).then(extractData),
  reorder: (projectId: string, taskId: string, data: { prevTaskId?: string; nextTaskId?: string }) =>
    api.post<Task>(`/projects/${projectId}/tasks/${taskId}/reorder`, data).then(extractData),
  move: (projectId: string, taskId: string, data: { parentId?: string }) =>
    api.post<Task>(`/projects/${projectId}/tasks/${taskId}/move`, data).then(extractData),
};

export const dependenciesApi = {
  list: (projectId: string) =>
    api.get<Dependency[]>(`/projects/${projectId}/dependencies`).then(extractData),
  create: (projectId: string, data: Partial<Dependency>) =>
    api.post<Dependency>(`/projects/${projectId}/dependencies`, data).then(extractData),
  remove: (projectId: string, dependencyId: string) =>
    api.delete<void>(`/projects/${projectId}/dependencies/${dependencyId}`).then(extractData),
};

export const resourcesApi = {
  list: (projectId: string) =>
    api.get<Resource[]>(`/projects/${projectId}/resources`).then(extractData),
  create: (projectId: string, data: Partial<Resource>) =>
    api.post<Resource>(`/projects/${projectId}/resources`, data).then(extractData),
  update: (projectId: string, resourceId: string, data: Partial<Resource>) =>
    api.patch<Resource>(`/projects/${projectId}/resources/${resourceId}`, data).then(extractData),
  remove: (projectId: string, resourceId: string) =>
    api.delete<void>(`/projects/${projectId}/resources/${resourceId}`).then(extractData),
  workload: (projectId: string) =>
    api.get<ResourceWorkload[]>(`/projects/${projectId}/resources/workload`).then(extractData),
};

export const baselinesApi = {
  list: (projectId: string) =>
    api.get<Baseline[]>(`/projects/${projectId}/baselines`).then(extractData),
  get: (projectId: string, baselineId: string) =>
    api.get<Baseline>(`/projects/${projectId}/baselines/${baselineId}`).then(extractData),
  create: (projectId: string, data: { name: string }) =>
    api.post<Baseline>(`/projects/${projectId}/baselines`, data).then(extractData),
  remove: (projectId: string, baselineId: string) =>
    api.delete<void>(`/projects/${projectId}/baselines/${baselineId}`).then(extractData),
};

export const importExportApi = {
  exportCsv: (projectId: string) =>
    api.get<Blob>(`/projects/${projectId}/export/csv`, { responseType: 'blob' }).then(extractData),
  exportJson: (projectId: string) =>
    api.get<any>(`/projects/${projectId}/export/json`).then(extractData),
  importCsv: (projectId: string, formData: FormData) =>
    api.post<Task[]>(`/projects/${projectId}/import/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(extractData),
  importJson: (projectId: string, data: any) =>
    api.post<Task[]>(`/projects/${projectId}/import/json`, data).then(extractData),
};

export const activityLogsApi = {
  list: (projectId: string, page: number = 1, pageSize: number = 20, actionType?: ActionType) => {
    const params: Record<string, any> = { page, pageSize };
    if (actionType) params.actionType = actionType;
    return api
      .get<PaginatedActivityLogs>(`/projects/${projectId}/activity-logs`, { params })
      .then(extractData);
  },
};

export default api;
