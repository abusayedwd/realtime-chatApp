'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setCredentials } from '@/store/slices/authSlice'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { useUpdateMeMutation } from '@/store/api/userApi'
import { uploadAvatar } from '@/store/api/userApi'
import { useChangePasswordMutation } from '@/store/api/authApi'
import { updateProfileSchema, changePasswordSchema, UpdateProfileValues, ChangePasswordValues } from '@/validations/authSchema'
import type { IUser } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'profile' | 'password'

export const ProfileModal = ({ open, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>('profile')
  const dispatch = useAppDispatch()
  const me = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)

  const [updateMe, { isLoading: isSaving }] = useUpdateMeMutation()
  const [changePassword, { isLoading: isChanging }] = useChangePasswordMutation()

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    // Local preview
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      setUploadingAvatar(true)
      const updated = await uploadAvatar(file, accessToken)
      dispatch(setCredentials({ accessToken: accessToken!, user: updated as unknown as IUser }))
      dispatch(pushToast(toast.success('Profile picture updated!')))
      setAvatarPreview(null)
    } catch {
      dispatch(pushToast(toast.error('Failed to upload image')))
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ── Profile form ─────────────────────────────────────────────────────────────
  const profileForm = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: me?.name ?? '' },
  })

  const onProfileSubmit = async (values: UpdateProfileValues) => {
    try {
      const updated = await updateMe(values).unwrap()
      dispatch(setCredentials({ accessToken: accessToken!, user: updated as unknown as IUser }))
      dispatch(pushToast(toast.success('Profile updated!')))
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string }).message ?? 'Update failed')))
    }
  }

  // ── Change password form ─────────────────────────────────────────────────────
  const pwForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onPasswordSubmit = async (values: ChangePasswordValues) => {
    try {
      await changePassword(values).unwrap()
      dispatch(pushToast(toast.success('Password changed successfully!')))
      pwForm.reset()
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Failed to change password'
      pwForm.setError('currentPassword', { message: msg })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Profile & Settings">
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl bg-bg-hover p-1">
        {(['profile', 'password'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              tab === t
                ? 'bg-bg-panel text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t === 'profile' ? 'Profile' : 'Password'}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === 'profile' && (
        <div className="flex flex-col gap-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                src={avatarPreview ?? me?.avatar}
                name={me?.name ?? ''}
                size="xl"
              />
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="rounded-lg border border-line bg-bg-hover px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand/50 hover:text-ink disabled:opacity-50"
            >
              {uploadingAvatar ? 'Uploading…' : 'Change photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={handleAvatarPick}
            />
          </div>

          {/* Name form */}
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="flex flex-col gap-4">
            <Input
              label="Full name"
              placeholder="Ada Lovelace"
              {...profileForm.register('name')}
              error={profileForm.formState.errors.name?.message}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-muted">Email</label>
              <div className="flex h-10 items-center rounded-lg border border-line bg-bg-input px-3 text-sm text-ink-muted">
                {me?.email}
              </div>
            </div>
            <Button type="submit" fullWidth isLoading={isSaving}>
              Save changes
            </Button>
          </form>
        </div>
      )}

      {/* ── Password tab ── */}
      {tab === 'password' && (
        <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...pwForm.register('currentPassword')}
            error={pwForm.formState.errors.currentPassword?.message}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            hint="Min 8 chars · uppercase · lowercase · number"
            {...pwForm.register('newPassword')}
            error={pwForm.formState.errors.newPassword?.message}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...pwForm.register('confirmNewPassword')}
            error={pwForm.formState.errors.confirmNewPassword?.message}
          />
          <Button type="submit" fullWidth isLoading={isChanging}>
            Change password
          </Button>
        </form>
      )}
    </Modal>
  )
}
