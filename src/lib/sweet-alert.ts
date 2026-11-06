import Swal from "sweetalert2";

export function showLoadingAlert(title: string, text: string) {
  void Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}
