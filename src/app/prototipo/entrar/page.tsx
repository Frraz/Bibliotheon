import { Marca } from "@/components/site/marca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Entrar() {
  return (
    <main className="grid min-h-dvh place-items-center bg-(--papel) px-5 py-12 font-(family-name:--font-texto) text-(--tinta)">
      <div className="w-full max-w-sm">
        <Marca />
        <h1 className="mt-10 font-(family-name:--font-display) text-[2rem] leading-none font-medium tracking-[-0.01em]">Entrar</h1>
        <form className="mt-8 space-y-5">
          <div>
            <Label htmlFor="email" className="mb-1.5 text-[0.9375rem] font-medium">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="senha" className="mb-1.5 text-[0.9375rem] font-medium">Senha</Label>
            <Input id="senha" type="password" autoComplete="current-password" required />
          </div>
          <Button type="button" size="lg" className="w-full">Entrar</Button>
        </form>
        <p className="mt-6 text-sm text-(--tinta-2) text-pretty">Esqueceu a senha? Fale com o administrador. O acesso é só para quem publica e-books aqui.</p>
      </div>
    </main>
  );
}
