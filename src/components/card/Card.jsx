import React from 'react'
import "./card.css"
const Card = ({icon,title,value}) => {
  return (
    <div className='card-container'>
<p className='database'>{title}</p>
<p className='value'>{value}</p>
    </div>
  )
}

export default Card