import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'
import logger from '../utils/logger.js'
import { config } from '../config/index.js'
import sql from './sql.js'

// 保持一个全局的数据库连接
let dbInstance = null

export function initDB() {
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(config.database.path)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(config.database.path)) {
    logger.info('Creating database:', config.database.path)
    const db = new Database(config.database.path)
    db.exec(sql[0].script)
    db.close()
  }
  updateDB()
}

function updateDB() {
  const db = connect()
  try {
    const dbVersionResult = db.prepare(`SELECT val FROM context WHERE key = ?`).get('db_version')
    const dbVersion = dbVersionResult ? dbVersionResult.val : '1'
    
    sql.filter(item => item.version > +dbVersion).forEach(item => {
      logger.info(`Updating database to version ${item.version}`)
      db.exec(item.script)
      db.prepare(`UPDATE context SET val = ? WHERE key = ?`).run(item.version.toString(), 'db_version')
    })
  } catch (error) {
    logger.error('Error updating database:', error)
    throw error
  }
}

export function connect() {
  if (!dbInstance) {
    // 创建新连接
    dbInstance = new Database(config.database.path, {
      fileMustExist: false
    })

    // 优化配置
    dbInstance.pragma('journal_mode = WAL')
    dbInstance.pragma('synchronous = NORMAL')

    // 包装原始方法以添加日志
    const originalPrepare = dbInstance.prepare.bind(dbInstance)
    dbInstance.prepare = function (sql) {
      const stmt = originalPrepare(sql)
      const originalRun = stmt.run.bind(stmt)
      const originalGet = stmt.get.bind(stmt)
      const originalAll = stmt.all.bind(stmt)

      // 包装 run 方法
      stmt.run = function (...args) {
        const options = args[args.length - 1]
        const shouldLog = !(options && typeof options === 'object' && options.silent === true)
        
        if (shouldLog && process.env.NODE_ENV === 'development') {
          logger.debug('[SQL Run]:', sql, args)
        }
        
        const sqlArgs = options && typeof options === 'object' ? args.slice(0, -1) : args
        return originalRun(...sqlArgs)
      }

      // 包装 get 方法
      stmt.get = function (...args) {
        const options = args[args.length - 1]
        const shouldLog = !(options && typeof options === 'object' && options.silent === true)
        
        if (shouldLog && process.env.NODE_ENV === 'development') {
          logger.debug('[SQL Get]:', sql, args)
        }
        
        const sqlArgs = options && typeof options === 'object' ? args.slice(0, -1) : args
        return originalGet(...sqlArgs)
      }

      // 包装 all 方法
      stmt.all = function (...args) {
        const options = args[args.length - 1]
        const shouldLog = !(options && typeof options === 'object' && options.silent === true)
        
        if (shouldLog && process.env.NODE_ENV === 'development') {
          logger.debug('[SQL All]:', sql, args)
        }
        
        const sqlArgs = options && typeof options === 'object' ? args.slice(0, -1) : args
        return originalAll(...sqlArgs)
      }

      return stmt
    }

    logger.info('[DB] Connected to:', config.database.path)
  }
  return dbInstance
}
