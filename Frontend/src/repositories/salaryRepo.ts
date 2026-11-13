import type { SalaryMonth } from '@/types'
import { getSalaryYear } from '@/api/salary'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'

export async function getSalaryYearOfflineFirst(
  idUser: number,
  year: number,
): Promise<{ data?: { items: SalaryMonth[] }; error?: { status: number; message: string } }> {
  if (isOnlineNow()) {
    const res = await getSalaryYear(idUser, year)
    if (res.data?.items?.length) {
      await lepraDb.salaryMonths.bulkPut(res.data.items)
    }
    return res
  }
  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin conexión' } }
  }
  const items = await lepraDb.salaryMonths
    .where('id_user')
    .equals(idUser)
    .filter((row) => row.year === year)
    .toArray()
  return { data: { items } }
}
