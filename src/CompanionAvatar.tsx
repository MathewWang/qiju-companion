import React from 'react';
import characters from '../shared/characters.json';
export function CompanionAvatar({skin,name,className=''}:{skin?:string;name:string;className?:string}){
 const preset=characters.find(c=>c.id===(skin==='peach'?'taotao':skin));
 return <span className={`companion-avatar ${className}`} role="img" aria-label={`${name}的头像`}>{preset?<img src={preset.image} alt="" draggable={false}/>:<span>{name.slice(0,1)}</span>}</span>;
}
