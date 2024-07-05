import { v4 as uuid } from 'uuid'


export async function handler(event: any, context: any) {

  return {
    statusCode: 200,
    body: {
      message: 'Hello ' + uuid()
    }
  }
}
