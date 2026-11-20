import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, Loader2 } from 'lucide-react'
import { cn, formatBytes, formatDate, formatRelativeDate } from '@lib/utils'
import { fileService } from '@services/files/fileService'
import { authService } from '@services/auth/authService'
import { useFileStore } from '@stores/fileStore'
import { QUERY_KEYS } from '@lib/constants'
import { ComingSoon } from '@/components/ui/feedback'
import type { FileItem, FileVersion } from '@/types/files'

export type PreviewTab = 'details' | 'versions' | 'activity'

interface PreviewDetailsPanelProps {
  file: FileItem
  activeTab: PreviewTab
  onTabChange: (tab: PreviewTab) => void
}

const TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'versions', label: 'Versions' },
  { id: 'activity', label: 'Activity' },
]

export function PreviewDetailsPanel({ file, activeTab, onTabChange }: PreviewDetailsPanelProps) {
  return (
    <>
      <div className="uv-preview-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn('uv-preview-tab', activeTab === tab.id && 'uv-preview-tab-active')}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="uv-preview-panelarea" role="tabpanel">
        {activeTab === 'details' && <DetailsPanel file={file} />}
        {activeTab === 'versions' && <VersionsPanel file={file} />}
        {activeTab === 'activity' && (
          <div className="px-2 py-6">
            <ComingSoon
              icon={Activity}
              title="File activity"
              description="A live feed of every open, share, and edit for this file is coming soon."
            />
          </div>
        )}
      </div>
    </>
  )
}

/** "Vault / photos" from the file's own folder chain in the store. */
function locationOf(file: FileItem): string {
  const state = useFileStore.getState()
  const parts: string[] = []
  let parentId = file.folderId
  let guard = 0
  while (parentId && guard < 32) {
    const folder = state.folders.get(parentId)
    if (!folder) break
    parts.unshift(folder.name)
    parentId = folder.parentId
    guard++
  }
  return ['Vault', ...parts].join(' / ')
}

/** Details tab — real metadata rows (36 high · r6, hover fill). */
function DetailsPanel({ file }: { file: FileItem }) {
  const rows: Array<{ label: string; value: string }> = useMemo(
    () => [
      { label: 'Size', value: formatBytes(file.totalSize) },
      { label: 'Type', value: file.mimeType || 'Unknown' },
      { label: 'Location', value: locationOf(file) },
      { label: 'Modified', value: formatRelativeDate(file.updatedAt) },
      { label: 'Created', value: formatDate(file.createdAt) },
      { label: 'Version', value: `v${file.version}` },
      { label: 'Encryption', value: 'End-to-end · on-device keys' },
    ],
    [file]
  )
  return (
    <div>
      {rows.map((row) => (
        <div key={row.label} className="uv-preview-detail-row">
          <span className="uv-preview-detail-label">{row.label}</span>
          <span className="uv-preview-detail-value" title={row.value}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Versions tab — sheet rows (48 high · r8 · current on Hover fill) with Restore. */
function VersionsPanel({ file }: { file: FileItem }) {
  const queryClient = useQueryClient()
  const [versions, setVersions] = useState<FileVersion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const fetchVersions = useCallback(async (fileId: string) => {
    try {
      const data = await fileService.listVersions(fileId)
      setVersions([...data].sort((a, b) => b.version_number - a.version_number))
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load version history.')
    }
  }, [])

  useEffect(() => {
    setVersions(null)
    setLoadError(null)
    void fetchVersions(file.id)
  }, [file.id, fetchVersions])

  /** Device names for the "who saved this" column (authService.getDevices). */
  const [deviceNames, setDeviceNames] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    authService
      .getDevices()
      .then((devices) => {
        if (cancelled) return
        setDeviceNames(new Map(devices.map((d) => [d.device_id, d.device_name])))
      })
      .catch(() => {
        /* device names are a nice-to-have; rows fall back to "Version n" */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRestore = async (version: FileVersion) => {
    if (restoringId) return
    setRestoringId(version.version_id)
    try {
      await fileService.restoreVersion(file.id, version.version_id)
      await fetchVersions(file.id)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.LIST] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.FILES.DETAIL, file.id] })
      toast.success(`Restored ${file.name} to v${version.version_number}`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to restore version.')
    } finally {
      setRestoringId(null)
    }
  }

  if (loadError) {
    return <div className="text-failed px-2.5 py-3 text-[13px] leading-5">{loadError}</div>
  }

  if (!versions) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="text-ghost h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="text-muted-foreground px-2.5 py-3 text-[13px] leading-5">
        Only one version exists — new uploads will appear here.
      </div>
    )
  }

  return (
    <div>
      {versions.map((version) => {
        const isCurrent = version.is_active
        const title = isCurrent
          ? 'Current · this device'
          : deviceNames.get(version.created_by_device_id) || `Version ${version.version_number}`
        return (
          <div
            key={version.version_id}
            className={cn('uv-preview-version', isCurrent && 'uv-preview-version-current')}
          >
            <span className="uv-preview-version-label">v{version.version_number}</span>
            <div className="min-w-0 flex-1">
              <div className="text-ink truncate text-[13.5px] leading-5">{title}</div>
              <div className="uv-preview-meta truncate">
                {formatVersionDate(version.created_at)} · {formatBytes(version.total_size)}
              </div>
            </div>
            {!isCurrent && (
              <button
                type="button"
                className="uv-preview-restore"
                disabled={restoringId === version.version_id}
                onClick={() => void handleRestore(version)}
              >
                {restoringId === version.version_id ? 'Restoring…' : 'Restore'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** "Today, 4:36 PM" for today, "Sep 10, 2026" otherwise (sheet copy). */
function formatVersionDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
    return `Today, ${time}`
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
