export enum FileUploadLocation {
  LOGO = 'logo',
  EMPLOYEES_AVATAR = 'employees-avatar',
  DOCUMENTS = 'documents',
  ATTACHMENTS = 'attachments',
  AVATARS = 'avatars',
  RESUMES = 'resumes',
  ASSETS = 'assets',
}
export const FILE_UPLOAD_LOCATION_DESCRIPTIONS = {
  [FileUploadLocation.LOGO]: 'Workspace/Company logos',
  [FileUploadLocation.EMPLOYEES_AVATAR]: 'Employee profile pictures',
  [FileUploadLocation.DOCUMENTS]: 'Employee documents (ID, passport, certificates, contracts)',
  [FileUploadLocation.ATTACHMENTS]: 'File attachments',
  [FileUploadLocation.AVATARS]: 'User avatars',
  [FileUploadLocation.RESUMES]: 'Candidate resumes',
  [FileUploadLocation.ASSETS]: 'Company asset documents',
} as const;
