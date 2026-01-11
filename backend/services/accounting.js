const { prisma } = require('./prisma')

async function getAccountsTree() {
  const accounts = await prisma.account.findMany({ orderBy: { account_number: 'asc' } })
  const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]))
  const roots = []
  for (const a of byId.values()) {
    if (a.parent_id) {
      const p = byId.get(a.parent_id)
      if (p) p.children.push(a)
      else roots.push(a)
    } else {
      roots.push(a)
    }
  }
  return roots
}

async function nextAccountNumber(parent_id) {
  if (!parent_id) {
    const last = await prisma.account.findMany({ orderBy: { account_number: 'desc' }, take: 1 })
    const n = last.length ? parseInt(last[0].account_number, 10) + 1 : 1000
    return String(n)
  }
  const siblings = await prisma.account.findMany({ where: { parent_id }, orderBy: { account_number: 'desc' }, take: 1 })
  const base = await prisma.account.findUnique({ where: { id: parent_id } })
  const prefix = base ? base.account_number : '1000'
  const n = siblings.length ? parseInt(siblings[0].account_number, 10) + 1 : parseInt(prefix + '01', 10)
  return String(n)
}

async function createAccount(data) {
  const number = data.account_number || await nextAccountNumber(data.parent_id || null)
  return prisma.account.create({ data: { account_number: number, name: data.name, type: data.type, nature: data.nature, parent_id: data.parent_id || null, opening_balance: data.opening_balance || 0 } })
}

async function updateAccount(id, data) {
  return prisma.account.update({ where: { id: Number(id) }, data })
}

async function canDeleteAccount(id) {
  const postings = await prisma.journalPosting.count({ where: { account_id: Number(id) } })
  return postings === 0
}

async function deleteAccount(id) {
  const ok = await canDeleteAccount(id)
  if (!ok) return false
  await prisma.account.delete({ where: { id: Number(id) } })
  return true
}

async function nextEntryNumber() {
  const last = await prisma.journalEntry.findMany({ orderBy: { entry_number: 'desc' }, take: 1 })
  return last.length ? last[0].entry_number + 1 : 1
}

async function postJournal({ description, date, postings, reference_type, reference_id }) {
  const entry_number = await nextEntryNumber()
  return prisma.journalEntry.create({ data: { entry_number, description, date: new Date(date), reference_type: reference_type || null, reference_id: reference_id || null, postings: { create: postings.map(p => ({ account_id: p.account_id, debit: p.debit || 0, credit: p.credit || 0 })) } } })
}

async function getAccountJournal(id, { from, to }) {
  return prisma.journalPosting.findMany({ where: { account_id: Number(id), journal: { date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } }, include: { journal: true }, orderBy: { journal_entry_id: 'desc' } })
}

async function deleteJournal(id) {
  await prisma.journalPosting.deleteMany({ where: { journal_entry_id: Number(id) } })
  await prisma.journalEntry.delete({ where: { id: Number(id) } })
  return true
}

module.exports = { getAccountsTree, createAccount, updateAccount, deleteAccount, postJournal, getAccountJournal, deleteJournal }
