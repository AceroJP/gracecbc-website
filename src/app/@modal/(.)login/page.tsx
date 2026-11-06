import { LoginScreen } from "@/components/auth/login-screen";
import { LoginModal } from "@/components/auth/login-modal";

type LoginModalPageProps = {
  searchParams: Promise<{ error?: string; notice?: string }>;
};

export default function LoginModalPage({
  searchParams,
}: LoginModalPageProps) {
  return (
    <LoginModal>
      <LoginScreen modal searchParams={searchParams} />
    </LoginModal>
  );
}
