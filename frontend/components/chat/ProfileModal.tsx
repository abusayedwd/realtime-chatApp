'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch'
import { setCredentials, updateUser } from '@/store/slices/authSlice'
import { pushToast, toast } from '@/store/slices/uiSlice'
import { useUpdateMeMutation, useGetBlockedUsersQuery, useUnblockUserMutation } from '@/store/api/userApi'
import { uploadAvatar } from '@/store/api/userApi'
import { useChangePasswordMutation } from '@/store/api/authApi'
import { updateProfileSchema, changePasswordSchema, UpdateProfileValues, ChangePasswordValues } from '@/validations/authSchema'
import type { IUser } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'profile' | 'password' | 'blocked'

export const ProfileModal = ({ open, onClose }: Props) => {
  const [tab, setTab] = useState<Tab>('profile')
  const dispatch = useAppDispatch()
  const me = useAppSelector((s) => s.auth.user)
  const accessToken = useAppSelector((s) => s.auth.accessToken)

  const [updateMe, { isLoading: isSaving }] = useUpdateMeMutation()
  const [changePassword, { isLoading: isChanging }] = useChangePasswordMutation()
  const { data: blockedUsers, isLoading: isLoadingBlocked } = useGetBlockedUsersQuery(undefined, {
    skip: !open,
  })
  const [unblockUser] = useUnblockUserMutation()

  const onUnblock = async (userId: string) => {
    try {
      const updated = await unblockUser(userId).unwrap()
      dispatch(updateUser({ blockedUsers: updated.blockedUsers }))
      dispatch(pushToast(toast.success('User unblocked')))
    } catch (err) {
      dispatch(pushToast(toast.error((err as { message?: string }).message ?? 'Unblock failed')))
    }
  }

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
        {(['profile', 'password', 'blocked'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              tab === t
                ? 'bg-bg-panel text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t === 'profile' ? 'Profile' : t === 'password' ? 'Password' : 'Blocked'}
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

      {/* ── Blocked users tab ── */}
      {tab === 'blocked' && (
        <div className="flex flex-col gap-2">
          {isLoadingBlocked ? (
            <p className="py-6 text-center text-sm text-ink-dim">Loading…</p>
          ) : !blockedUsers || blockedUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-dim">You haven't blocked anyone</p>
          ) : (
            blockedUsers.map((u) => (
              <div
                key={u._id}
                className="flex items-center gap-3 rounded-xl border border-line bg-bg-hover px-3 py-2.5"
              >
                <Avatar src={u.avatar} name={u.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                  <p className="truncate text-xs text-ink-dim">{u.email}</p>
                </div>
                <button
                  onClick={() => void onUnblock(u._id)}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand/50 hover:text-ink"
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  )
}
