import { connect } from '../db/index.js'

export function selectPage({ page, pageSize, name = '' }) {
  const db = connect()
  const offset = (page - 1) * pageSize
  const rows = db
    .prepare(
      `SELECT *
      FROM video
      WHERE name like '%${name}%'
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}; `
    )
    .all({ silent: true })
  return rows
}

export function count(name = '') {
  const db = connect()
  const rows = db.prepare(`SELECT COUNT(*) as total FROM video WHERE name like '%${name}%'`).get({ silent: true })
  return rows.total
}

/**
 * 新增视频
 * @param {object} video 视频对象
 * @returns
 */
export function insert(video) {
  const db = connect()
  const columns = Object.keys(video)
  const stmt = db.prepare(
    `insert into video (${columns.join(',')}, created_at)
     values (${columns.map(() => '?').join(',')}, ?)`
  )
  const info = stmt.run(
    ...Object.values(video).map((value) =>
      typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
    ),
    Date.now()
  )
  return info.lastInsertRowid
}

export function remove(id) {
  const db = connect()
  db.prepare(`DELETE FROM video WHERE id = ?`).run(id)
}

export function update(video) {
  const sets = Object.keys(video)
    .filter(key => key !== 'id')
    .map((key) => `${key} = ?`)
    .join(',')
  const db = connect()
  const values = Object.keys(video)
    .filter(key => key !== 'id')
    .map(key => video[key])
    .map((value) =>
      typeof value === 'object' && value !== null ? JSON.stringify(value) : value
    )
  const info = db
    .prepare(`UPDATE video SET ${sets} WHERE id = ?`)
    .run(...values, video.id)
  return info
}

export function selectByStatus(status) {
  const db = connect()
  const rows = db.prepare(`SELECT * FROM video WHERE status = ?`).all(status, { silent: true })
  return rows
}

export function findFirstByStatus(status) {
  const db = connect()
  const row = db.prepare(`SELECT * FROM video WHERE status = ? LIMIT 1`).get(status, { silent: true })
  return row
}

export function updateStatus(id, status, message, progress = 0, file_path = '') {
  const db = connect()
  db.prepare(
    `UPDATE video SET status = ?, message = ?, progress = ?, file_path = ? WHERE id = ?`
  ).run(status, message, progress, file_path, id)
}

export function selectByID(id) {
  const db = connect()
  const row = db.prepare(`SELECT * FROM video WHERE id = ?`).get(id)
  return row
}
