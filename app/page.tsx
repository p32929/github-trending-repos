"use client";

import { Button } from '@/components/ui/button';
import { controller } from '@/lib/StatesController';
import React from 'react'
import { useSelector } from 'react-redux';

interface Props {

}

const Page: React.FC<Props> = (props) => {
  const states = useSelector(() => controller.states);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-2xl text-center" >
          Counter {states.counter}
        </h1>
        <Button className='w-14 m-4' onClick={() => {
          controller.increase()
        }}>
          +
        </Button>
        <Button className='w-14 m-4' onClick={() => {
          controller.decrease()
        }}>
          -
        </Button>
      </div>
    </main>
  )

}

export default Page;