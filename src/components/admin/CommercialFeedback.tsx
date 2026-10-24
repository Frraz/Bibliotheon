'use client'
import {createContext,useEffect,useRef,useState,type ReactNode} from 'react'

export const CommercialFeedbackContext=createContext<((message:string)=>void)|null>(null)
/** Remains mounted when a queued event leaves the active attention filter. */
export function CommercialFeedback({children}:{children:ReactNode}){
 const [message,setMessage]=useState(''),notice=useRef<HTMLParagraphElement>(null)
 useEffect(()=>{if(message)notice.current?.focus()},[message])
 return <CommercialFeedbackContext.Provider value={setMessage}><p ref={notice} role="status" tabIndex={-1}>{message}</p>{children}</CommercialFeedbackContext.Provider>
}
