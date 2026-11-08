/** 主题输入：搜索框 + 灵感标签。 */
'use client'

import type { FormEvent } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import s from './space.module.css'

interface Props {
  value: string
  loading: boolean
  presets: string[]
  onChange: (value: string) => void
  onSubmit: () => void
  onPick: (value: string) => void
}

export function SearchBar({ value, loading, presets, onChange, onSubmit, onPick }: Props) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <>
      <form className={s.form} onSubmit={submit} data-testid="space-form">
        <Wand2 className={`w-5 h-5 ${s.formIcon}`} aria-hidden />
        <input
          className={s.input}
          data-testid="space-input"
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={40}
          placeholder="导演、类型，或某个念头…"
          aria-label="导演或主题"
        />
        <button className={s.submit} type="submit" disabled={loading} data-testid="space-submit">
          {loading ? <><Loader2 className="w-4 h-4 spin" /> 生成中</> : '生成影展'}
        </button>
      </form>

      <div className={s.presets}>
        {presets.map(preset => (
          <button
            type="button"
            key={preset}
            className={s.preset}
            data-testid="space-preset"
            onClick={() => onPick(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </>
  )
}
