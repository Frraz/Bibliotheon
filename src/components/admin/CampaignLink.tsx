import type {UIFieldServerComponent} from 'payload'
import {campaignLink} from '../../modules/analytics/admin'
export const CampaignLink:UIFieldServerComponent=async({data,req})=>{
 if(req.user?.collection!=='admin-users'||req.user.role!=='owner')return null
 if(!data?.id)return <p>Salve a campanha para preparar o link de divulgação.</p>
 let url:string|undefined
 try{url=await campaignLink(req,String(data.id))}catch{/* Saved records are validated before exposing a usable link. */}
 if(!url)return <p>O link ficará disponível após ativar e conferir campanha, livro, oferta e códigos de origem.</p>
 return <section className="bibliotheon-sequence-copy"><h2>Link de divulgação</h2><p><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p><p>Copie o endereço do link. Ele usa os dados salvos da campanha; salve alterações para atualizá-lo. A medição depende da escolha do visitante e um clique não confirma compra.</p></section>
}
